package dev.asdf.tools;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
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
import org.eclipse.jdt.core.dom.ASTNode;
import org.eclipse.jdt.core.dom.ASTParser;
import org.eclipse.jdt.core.dom.ASTVisitor;
import org.eclipse.jdt.core.dom.AbstractTypeDeclaration;
import org.eclipse.jdt.core.dom.BodyDeclaration;
import org.eclipse.jdt.core.dom.CastExpression;
import org.eclipse.jdt.core.dom.ClassInstanceCreation;
import org.eclipse.jdt.core.dom.CompilationUnit;
import org.eclipse.jdt.core.dom.Expression;
import org.eclipse.jdt.core.dom.MethodInvocation;
import org.eclipse.jdt.core.dom.Name;
import org.eclipse.jdt.core.dom.FieldAccess;
import org.eclipse.jdt.core.dom.ThisExpression;
import org.eclipse.jdt.core.dom.ParenthesizedExpression;
import org.eclipse.jdt.core.dom.SuperMethodInvocation;
import org.eclipse.jdt.core.formatter.CodeFormatter;
import org.eclipse.jdt.internal.formatter.DefaultCodeFormatter;
import org.eclipse.jface.text.Document;
import org.eclipse.jface.text.IRegion;
import org.eclipse.jface.text.Region;
import org.eclipse.text.edits.TextEdit;
import org.eclipse.text.edits.MultiTextEdit;
import org.eclipse.text.edits.ReplaceEdit;
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
            if (line.trim().isEmpty())
                continue;
            int tab = line.indexOf('\t');
            Path file = Paths.get(tab < 0 ? line : line.substring(0, tab));
            format(formatter, chainFormatter, options, file, tab < 0 ? null : changedLines(line.substring(tab + 1)));
        }
    }

    /** Parses "3-7,12-12" into inclusive 1-based line ranges; "*" returns null, meaning the whole file. */
    private static List<int[]> changedLines(String value) {
        if ("*".equals(value.trim()))
            return null;
        List<int[]> ranges = new ArrayList<int[]>();
        for (String range : value.split(",")) {
            if (range.trim().isEmpty())
                continue;
            String[] bounds = range.trim().split("-");
            ranges.add(new int[] {Integer.parseInt(bounds[0]), Integer.parseInt(bounds[1])});
        }
        return ranges;
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

    private static void format(CodeFormatter formatter, CodeFormatter chainFormatter, Map<String, String> options, Path file,
                               List<int[]> changedLines)
            throws Exception {
        String source = new String(Files.readAllBytes(file), StandardCharsets.UTF_8);
        CompilationUnit unit = parse(source, options, file);
        // Regions are kept as token spans: every pass only moves whitespace, so a span names the same code in each pass.
        List<int[]> spans = changedLines == null ? null : tokenSpans(source, unit, changedLines);
        if (spans != null && spans.isEmpty())
            return;
        String lineSeparator = source.contains("\r\n") ? "\r\n" : "\n";
        TextEdit edit = formatter.format(CodeFormatter.K_COMPILATION_UNIT, source, regions(source, spans), 0, lineSeparator);
        if (edit == null) {
            throw new IOException("Eclipse JDT could not parse " + file);
        }
        Document document = new Document(source);
        edit.apply(document);
        String jdtFormatted = document.get();
        CompilationUnit formattedUnit = parse(jdtFormatted, options, file);
        String expanded = expandInvocationChains(jdtFormatted, formattedUnit, options, lineSeparator, regions(jdtFormatted, spans));
        TextEdit chainEdit = chainFormatter.format(CodeFormatter.K_COMPILATION_UNIT, expanded, regions(expanded, spans), 0, lineSeparator);
        if (chainEdit == null) {
            throw new IOException("Eclipse JDT could not parse expanded invocation chains in " + file);
        }
        Document chainDocument = new Document(expanded);
        chainEdit.apply(chainDocument);
        String chained = chainDocument.get();
        String formatted = joinInvocationReceivers(chained, options, file, lineSeparator, regions(chained, spans));
        assertSameTokens(source, formatted, file);
        if (spans != null)
            assertOutsideUnchanged(source, formatted, spans, file);
        Files.write(file, formatted.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Widens each changed line range to the outermost method, field, or initializer it touches and returns the
     * covered tokens as merged [first, last] index spans. A change outside every member keeps only its own lines, so
     * editing a class header or an import never reformats the whole type.
     */
    private static List<int[]> tokenSpans(String source, CompilationUnit unit, List<int[]> changedLines) throws Exception {
        final List<ASTNode> members = new ArrayList<ASTNode>();
        unit.accept(new ASTVisitor() {
            @Override
            public void preVisit(ASTNode node) {
                if (isMember(node) && !insideMember(node))
                    members.add(node);
            }
        });
        List<int[]> positions = tokenPositions(source);
        int lineCount = unit.getLineNumber(Math.max(source.length() - 1, 0));
        List<int[]> spans = new ArrayList<int[]>();
        for (int[] lines : changedLines) {
            if (lines[0] > lineCount)
                continue;
            int start = unit.getPosition(lines[0], 0);
            int end = lineEnd(source, unit.getPosition(Math.min(lines[1], lineCount), 0));
            for (ASTNode member : members) {
                int memberStart = member.getStartPosition();
                int memberEnd = memberStart + member.getLength();
                if (memberStart < end && memberEnd > start) {
                    start = Math.min(start, memberStart);
                    end = Math.max(end, memberEnd);
                }
            }
            int first = -1;
            int last = -1;
            for (int index = 0; index < positions.size(); index++) {
                int[] token = positions.get(index);
                if (token[0] >= start && token[1] <= end) {
                    if (first < 0)
                        first = index;
                    last = index;
                }
            }
            if (first >= 0)
                spans.add(new int[] {first, last});
        }
        spans.sort(Comparator.comparingInt(span -> span[0]));
        List<int[]> merged = new ArrayList<int[]>();
        for (int[] span : spans) {
            int[] previous = merged.isEmpty() ? null : merged.get(merged.size() - 1);
            // Spans whose line regions meet would overlap once formatted, so they merge as well.
            if (previous != null && charRegion(source, positions, previous)[1] >= charRegion(source, positions, span)[0]) {
                previous[1] = Math.max(previous[1], span[1]);
            } else {
                merged.add(span);
            }
        }
        return merged;
    }

    private static boolean isMember(ASTNode node) {
        return node instanceof BodyDeclaration && !(node instanceof AbstractTypeDeclaration);
    }

    private static boolean insideMember(ASTNode node) {
        for (ASTNode parent = node.getParent(); parent != null; parent = parent.getParent()) {
            if (isMember(parent))
                return true;
        }
        return false;
    }

    /** Maps token spans to whole-line character regions of this text; null spans cover the entire text. */
    private static IRegion[] regions(String text, List<int[]> spans) throws Exception {
        if (spans == null)
            return new IRegion[] {new Region(0, text.length())};
        List<int[]> positions = tokenPositions(text);
        IRegion[] regions = new IRegion[spans.size()];
        for (int index = 0; index < spans.size(); index++) {
            int[] region = charRegion(text, positions, spans.get(index));
            regions[index] = new Region(region[0], region[1] - region[0]);
        }
        return regions;
    }

    /**
     * A span's region runs from the line after its preceding token to the line of its following token, so the blank
     * lines and comments that separate a changed member from its neighbours belong to it while the neighbours' own
     * lines stay outside.
     */
    private static int[] charRegion(String text, List<int[]> positions, int[] span) {
        int firstStart = positions.get(span[0])[0];
        int lastEnd = positions.get(span[1])[1];
        int start = lineStart(text, firstStart);
        if (span[0] > 0)
            start = Math.min(start, nextLineStart(text, positions.get(span[0] - 1)[1]));
        else
            start = 0;
        int end = lineEnd(text, lastEnd);
        if (span[1] + 1 < positions.size()) {
            int following = lineStart(text, positions.get(span[1] + 1)[0]);
            if (following > lastEnd)
                end = Math.max(end, following);
        } else {
            end = text.length();
        }
        return new int[] {start, end};
    }

    private static int nextLineStart(String text, int position) {
        int end = lineEnd(text, position);
        if (end < text.length() && text.charAt(end) == '\r')
            end++;
        if (end < text.length() && text.charAt(end) == '\n')
            end++;
        return end;
    }

    private static boolean inside(IRegion[] regions, int position) {
        for (IRegion region : regions) {
            if (position >= region.getOffset() && position <= region.getOffset() + region.getLength())
                return true;
        }
        return false;
    }

    private static void assertOutsideUnchanged(String before, String after, List<int[]> spans, Path file) throws Exception {
        List<String> expected = outside(before, regions(before, spans));
        List<String> actual = outside(after, regions(after, spans));
        for (int index = 0; index < expected.size(); index++) {
            if (!expected.get(index).equals(actual.get(index))) {
                throw new IOException("Formatting reached outside the changed members of " + file + " (unchanged segment " + index
                        + " was [" + escape(expected.get(index)) + "], became [" + escape(actual.get(index)) + "]); refusing to write it.");
            }
        }
    }

    private static String escape(String text) {
        String visible = text.replace("\r", "\\r").replace("\n", "\\n");
        return visible.length() > 160 ? visible.substring(0, 160) + "..." : visible;
    }

    private static List<String> outside(String text, IRegion[] regions) {
        List<String> segments = new ArrayList<String>();
        int cursor = 0;
        for (IRegion region : regions) {
            segments.add(text.substring(cursor, region.getOffset()));
            cursor = region.getOffset() + region.getLength();
        }
        segments.add(text.substring(cursor));
        return segments;
    }

    private static int lineStart(String text, int position) {
        return text.lastIndexOf('\n', position - 1) + 1;
    }

    private static int lineEnd(String text, int position) {
        int end = position;
        while (end < text.length() && text.charAt(end) != '\n' && text.charAt(end) != '\r')
            end++;
        return end;
    }

    private static String joinInvocationReceivers(String source, Map<String, String> options, Path file, String lineSeparator,
                                                  final IRegion[] allowed)
            throws Exception {
        final MultiTextEdit edits = new MultiTextEdit();
        final int width = integerOption(options, "org.eclipse.jdt.core.formatter.lineSplit", 140);
        final int continuation = integerOption(options, "org.eclipse.jdt.core.formatter.indentation.size", 4)
                * integerOption(options, "org.eclipse.jdt.core.formatter.continuation_indentation", 2);
        parse(source, options, file).accept(new ASTVisitor() {
            @Override
            public boolean visit(MethodInvocation invocation) {
                Expression receiver = invocation.getExpression();
                if (!(receiver instanceof Name || receiver instanceof FieldAccess || receiver instanceof ThisExpression))
                    return true;
                int end = receiver.getStartPosition() + receiver.getLength();
                int name = invocation.getName().getStartPosition();
                if (!inside(allowed, end) || !inside(allowed, name))
                    return true;
                String separator = source.substring(end, name);
                if (separator.contains("/*") || separator.contains("//") || !containsLineBreak(source, end, name))
                    return true;
                String joined = separator.replaceFirst("^\\s*\\.\\s*", ".");
                if (separator.equals(joined))
                    return true;
                edits.addChild(new ReplaceEdit(end, name - end, joined));
                int lineStart = source.lastIndexOf('\n', end - 1) + 1;
                int lineEnd = source.indexOf('\n', name);
                if (lineEnd < 0)
                    lineEnd = source.length();
                if (!invocation.arguments().isEmpty()) {
                    Expression first = (Expression)invocation.arguments().get(0);
                    int open = source.indexOf('(', name + invocation.getName().getLength());
                    int argument = first.getStartPosition();
                    boolean wrapArguments = end - lineStart + joined.length() + lineEnd - name > width
                            || containsLineBreak(source, open + 1, argument);
                    if (wrapArguments && source.substring(open + 1, argument)
                            .trim()
                            .isEmpty()) {
                        String indentation = leadingWhitespace(source, receiver.getStartPosition()) + spaces(continuation);
                        edits.addChild(new ReplaceEdit(open + 1, argument - open - 1, lineSeparator + indentation));
                    }
                }
                return true;
            }
        });
        Document document = new Document(source);
        edits.apply(document);
        return document.get();
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

    private static String expandInvocationChains(String source, CompilationUnit unit, Map<String, String> options, String lineSeparator,
                                                 final IRegion[] allowed)
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
                        if (dot >= 0 && inside(allowed, dot))
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

    /** Start and exclusive end offsets of the same tokens {@link #tokens} compares, so index i names one token in every pass. */
    private static List<int[]> tokenPositions(String source) throws Exception {
        IScanner scanner = ToolFactory.createScanner(false, false, false, "1.8");
        scanner.setSource(source.toCharArray());
        List<int[]> positions = new ArrayList<int[]>();
        while (scanner.getNextToken() != ITerminalSymbols.TokenNameEOF) {
            positions.add(new int[] {scanner.getCurrentTokenStartPosition(), scanner.getCurrentTokenEndPosition() + 1});
        }
        return positions;
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
