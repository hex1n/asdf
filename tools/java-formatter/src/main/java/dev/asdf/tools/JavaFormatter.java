package dev.asdf.tools;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.eclipse.jdt.core.ToolFactory;
import org.eclipse.jdt.core.compiler.IProblem;
import org.eclipse.jdt.core.compiler.IScanner;
import org.eclipse.jdt.core.compiler.ITerminalSymbols;
import org.eclipse.jdt.core.dom.AST;
import org.eclipse.jdt.core.dom.ASTParser;
import org.eclipse.jdt.core.dom.ASTVisitor;
import org.eclipse.jdt.core.dom.CastExpression;
import org.eclipse.jdt.core.dom.ClassInstanceCreation;
import org.eclipse.jdt.core.dom.CompilationUnit;
import org.eclipse.jdt.core.dom.Expression;
import org.eclipse.jdt.core.dom.MethodInvocation;
import org.eclipse.jdt.core.dom.ParenthesizedExpression;
import org.eclipse.jdt.core.dom.SuperMethodInvocation;
import org.eclipse.jdt.core.formatter.CodeFormatter;
import org.eclipse.jdt.internal.formatter.DefaultCodeFormatter;
import org.eclipse.jface.text.Document;
import org.eclipse.text.edits.TextEdit;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

public final class JavaFormatter {

    /** Chains shorter than this stay as Eclipse laid them out; longer ones are forced one link per line. */
    private static final int MIN_CHAIN_LINKS = 3;

    private JavaFormatter() {}

    public static void main(String[] args) throws Exception {
        Path config = requiredPath("ASDF_JAVA_FORMAT_CONFIG");
        Path fileList = requiredPath("ASDF_JAVA_FORMAT_FILE_LIST");
        Map<String, String> options = readOptions(config);
        options.put("org.eclipse.jdt.core.compiler.compliance", "1.8");
        options.put("org.eclipse.jdt.core.compiler.source", "1.8");
        options.put("org.eclipse.jdt.core.compiler.codegen.targetPlatform", "1.8");

        CodeFormatter formatter = new DefaultCodeFormatter(options);
        Map<String, String> chainOptions = new HashMap<String, String>(options);
        chainOptions.put("org.eclipse.jdt.core.formatter.join_wrapped_lines", "false");
        CodeFormatter chainFormatter = new DefaultCodeFormatter(chainOptions);
        for (String line : Files.readAllLines(fileList, StandardCharsets.UTF_8)) {
            if (!line.trim().isEmpty()) {
                format(formatter, chainFormatter, options, Paths.get(line));
            }
        }
    }

    private static Path requiredPath(String name) {
        String value = System.getenv(name);
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException("Missing environment variable: " + name);
        }
        return Paths.get(value);
    }

    private static Map<String, String> readOptions(Path config) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        NodeList settings = factory.newDocumentBuilder()
                .parse(config.toFile())
                .getElementsByTagName("setting");
        Map<String, String> options = new HashMap<String, String>();
        for (int index = 0; index < settings.getLength(); index++) {
            Element setting = (Element)settings.item(index);
            options.put(setting.getAttribute("id"), setting.getAttribute("value"));
        }
        return options;
    }

    private static void format(CodeFormatter formatter, CodeFormatter chainFormatter, Map<String, String> options, Path file)
            throws Exception {
        String source = new String(Files.readAllBytes(file), StandardCharsets.UTF_8);
        parse(source, options, file);
        String lineSeparator = source.contains("\r\n") ? "\r\n" : "\n";
        TextEdit edit = formatter.format(CodeFormatter.K_COMPILATION_UNIT, source, 0, source.length(), 0, lineSeparator);
        if (edit == null) {
            throw new IOException("Eclipse JDT could not parse " + file);
        }
        Document document = new Document(source);
        edit.apply(document);
        String jdtFormatted = document.get();
        CompilationUnit formattedUnit = parse(jdtFormatted, options, file);
        String expanded = expandInvocationChains(jdtFormatted, formattedUnit, options, lineSeparator);
        TextEdit chainEdit = chainFormatter.format(CodeFormatter.K_COMPILATION_UNIT, expanded, 0, expanded.length(), 0, lineSeparator);
        if (chainEdit == null) {
            throw new IOException("Eclipse JDT could not parse expanded invocation chains in " + file);
        }
        Document chainDocument = new Document(expanded);
        chainEdit.apply(chainDocument);
        String formatted = chainDocument.get();
        assertSameTokens(source, formatted, file);
        Files.write(file, formatted.getBytes(StandardCharsets.UTF_8));
    }

    private static CompilationUnit parse(String source, Map<String, String> options, Path file) throws IOException {
        ASTParser parser = ASTParser.newParser(AST.JLS8);
        parser.setKind(ASTParser.K_COMPILATION_UNIT);
        parser.setCompilerOptions(options);
        parser.setResolveBindings(false);
        parser.setSource(source.toCharArray());
        CompilationUnit unit = (CompilationUnit)parser.createAST(null);
        for (IProblem problem : unit.getProblems()) {
            if (problem.isError()) {
                throw new IOException(
                        "Eclipse JDT could not parse " + file + " at line " + problem.getSourceLineNumber() + ": " + problem.getMessage());
            }
        }
        return unit;
    }

    private static String expandInvocationChains(String source, CompilationUnit unit, Map<String, String> options, String lineSeparator)
            throws Exception {
        final List<Integer> dots = dotPositions(source);
        final List<Integer> selectors = new ArrayList<Integer>();
        // Inner links are visited again after their outermost invocation; they are already decided there.
        final Set<MethodInvocation> consumed = Collections.newSetFromMap(new IdentityHashMap<MethodInvocation, Boolean>());
        unit.accept(new ASTVisitor() {
            @Override
            public boolean visit(MethodInvocation invocation) {
                if (consumed.contains(invocation)) {
                    return true;
                }
                // A chain is only forced vertical when it is long enough to read as a fluent pipeline;
                // two-link expressions such as value.trim().isEmpty() stay on one line.
                List<MethodInvocation> links = new ArrayList<MethodInvocation>();
                int linkCount = collectChain(invocation, links);
                consumed.addAll(links);
                if (linkCount < MIN_CHAIN_LINKS) {
                    return true;
                }
                for (MethodInvocation link : links) {
                    Expression expression = link.getExpression();
                    int expressionEnd = expression.getStartPosition() + expression.getLength();
                    int nameStart = link.getName().getStartPosition();
                    if (!containsLineBreak(source, expressionEnd, nameStart)) {
                        int dot = firstPositionBetween(dots, expressionEnd, nameStart);
                        if (dot >= 0)
                            selectors.add(Integer.valueOf(dot));
                    }
                }
                return true;
            }
        });
        if (selectors.isEmpty())
            return source;
        Collections.sort(selectors);

        int indentationSize = integerOption(options, "org.eclipse.jdt.core.formatter.indentation.size", 4);
        int continuationIndentation = integerOption(options, "org.eclipse.jdt.core.formatter.continuation_indentation", 2);
        String continuation = spaces(indentationSize * continuationIndentation);
        StringBuilder expanded = new StringBuilder(source);
        for (int index = selectors.size() - 1; index >= 0; index--) {
            int dot = selectors.get(index).intValue();
            expanded.insert(dot, lineSeparator + leadingWhitespace(source, dot) + continuation);
        }
        return expanded.toString();
    }

    /**
     * Walks a fluent chain from its outermost invocation towards its receiver, recording every
     * {@link MethodInvocation} whose receiver is itself an invocation. Returns the number of links, where a
     * terminating constructor or super call counts as one link: {@code new Item().a().b()} has three links.
     */
    private static int collectChain(MethodInvocation outermost, List<MethodInvocation> links) {
        int count = 1;
        MethodInvocation current = outermost;
        while (true) {
            Expression receiver = unwrap(current.getExpression());
            if (receiver instanceof MethodInvocation) {
                links.add(current);
                current = (MethodInvocation)receiver;
                count++;
                continue;
            }
            if (receiver instanceof ClassInstanceCreation || receiver instanceof SuperMethodInvocation) {
                links.add(current);
                count++;
            }
            return count;
        }
    }

    private static Expression unwrap(Expression expression) {
        if (expression instanceof ParenthesizedExpression) {
            return unwrap(((ParenthesizedExpression)expression).getExpression());
        }
        if (expression instanceof CastExpression) {
            return unwrap(((CastExpression)expression).getExpression());
        }
        return expression;
    }

    private static List<Integer> dotPositions(String source) throws Exception {
        IScanner scanner = ToolFactory.createScanner(false, false, false, "1.8");
        scanner.setSource(source.toCharArray());
        List<Integer> positions = new ArrayList<Integer>();
        int token;
        while ((token = scanner.getNextToken()) != ITerminalSymbols.TokenNameEOF) {
            if (token == ITerminalSymbols.TokenNameDOT) {
                positions.add(Integer.valueOf(scanner.getCurrentTokenStartPosition()));
            }
        }
        return positions;
    }

    private static int firstPositionBetween(List<Integer> positions, int start, int end) {
        for (Integer position : positions) {
            int value = position.intValue();
            if (value >= end)
                return -1;
            if (value >= start)
                return value;
        }
        return -1;
    }

    private static boolean containsLineBreak(String source, int start, int end) {
        for (int index = start; index < end; index++) {
            char value = source.charAt(index);
            if (value == '\n' || value == '\r')
                return true;
        }
        return false;
    }

    private static String leadingWhitespace(String source, int position) {
        int lineStart = source.lastIndexOf('\n', position - 1) + 1;
        int end = lineStart;
        while (end < source.length()) {
            char value = source.charAt(end);
            if (value != ' ' && value != '\t')
                break;
            end++;
        }
        return source.substring(lineStart, end);
    }

    private static int integerOption(Map<String, String> options, String name, int fallback) {
        try {
            return Integer.parseInt(options.get(name));
        } catch (RuntimeException error) {
            return fallback;
        }
    }

    private static String spaces(int count) {
        StringBuilder value = new StringBuilder(count);
        for (int index = 0; index < count; index++)
            value.append(' ');
        return value.toString();
    }

    private static void assertSameTokens(String before, String after, Path file) throws Exception {
        List<String> beforeTokens = tokens(before);
        List<String> afterTokens = tokens(after);
        if (!beforeTokens.equals(afterTokens)) {
            int limit = Math.min(beforeTokens.size(), afterTokens.size());
            int mismatch = 0;
            while (mismatch < limit && beforeTokens.get(mismatch).equals(afterTokens.get(mismatch))) {
                mismatch++;
            }
            String beforeToken = mismatch < beforeTokens.size() ? beforeTokens.get(mismatch) : "<EOF>";
            String afterToken = mismatch < afterTokens.size() ? afterTokens.get(mismatch) : "<EOF>";
            throw new IOException("Eclipse JDT changed a non-whitespace token in " + file + " at token " + mismatch + ": before="
                    + beforeToken + ", after=" + afterToken);
        }
    }

    private static List<String> tokens(String source) throws Exception {
        // Comments are not Java semantic tokens. Javadocs are protected byte-for-byte by the batch wrapper.
        IScanner scanner = ToolFactory.createScanner(false, false, false, "1.8");
        scanner.setSource(source.toCharArray());
        List<String> tokens = new ArrayList<String>();
        int token;
        while ((token = scanner.getNextToken()) != ITerminalSymbols.TokenNameEOF) {
            tokens.add(token + ":" + new String(scanner.getCurrentTokenSource()));
        }
        return tokens;
    }
}
