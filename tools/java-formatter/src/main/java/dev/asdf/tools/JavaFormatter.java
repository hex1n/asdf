package dev.asdf.tools;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.eclipse.jdt.core.ToolFactory;
import org.eclipse.jdt.core.compiler.IProblem;
import org.eclipse.jdt.core.compiler.IScanner;
import org.eclipse.jdt.core.compiler.ITerminalSymbols;
import org.eclipse.jdt.core.dom.AST;
import org.eclipse.jdt.core.dom.ASTParser;
import org.eclipse.jdt.core.dom.CompilationUnit;
import org.eclipse.jdt.core.formatter.CodeFormatter;
import org.eclipse.jdt.internal.formatter.DefaultCodeFormatter;
import org.eclipse.jface.text.Document;
import org.eclipse.text.edits.TextEdit;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

public final class JavaFormatter {

    private JavaFormatter() {}

    public static void main(String[] args) throws Exception {
        Path config = requiredPath("ASDF_JAVA_FORMAT_CONFIG");
        Path fileList = requiredPath("ASDF_JAVA_FORMAT_FILE_LIST");
        Map<String, String> options = readOptions(config);
        options.put("org.eclipse.jdt.core.compiler.compliance", "1.8");
        options.put("org.eclipse.jdt.core.compiler.source", "1.8");
        options.put("org.eclipse.jdt.core.compiler.codegen.targetPlatform", "1.8");

        CodeFormatter formatter = new DefaultCodeFormatter(options);
        for (String line : Files.readAllLines(fileList, StandardCharsets.UTF_8)) {
            if (!line.trim().isEmpty()) {
                format(formatter, options, Paths.get(line));
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
        NodeList settings = factory.newDocumentBuilder().parse(config.toFile()).getElementsByTagName("setting");
        Map<String, String> options = new HashMap<String, String>();
        for (int index = 0; index < settings.getLength(); index++) {
            Element setting = (Element)settings.item(index);
            options.put(setting.getAttribute("id"), setting.getAttribute("value"));
        }
        return options;
    }

    private static void format(CodeFormatter formatter, Map<String, String> options, Path file) throws Exception {
        String source = new String(Files.readAllBytes(file), StandardCharsets.UTF_8);
        assertParses(source, options, file);
        String lineSeparator = source.contains("\r\n") ? "\r\n" : "\n";
        TextEdit edit = formatter.format(CodeFormatter.K_COMPILATION_UNIT, source, 0, source.length(), 0, lineSeparator);
        if (edit == null) {
            throw new IOException("Eclipse JDT could not parse " + file);
        }
        Document document = new Document(source);
        edit.apply(document);
        String formatted = document.get();
        assertSameTokens(source, formatted, file);
        Files.write(file, formatted.getBytes(StandardCharsets.UTF_8));
    }

    private static void assertParses(String source, Map<String, String> options, Path file) throws IOException {
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
