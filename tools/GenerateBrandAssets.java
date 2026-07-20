import java.awt.AlphaComposite;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.Path2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import javax.imageio.ImageIO;

public final class GenerateBrandAssets {
    private static final Map<String, Integer> LEGACY_SIZES = Map.of(
        "mdpi", 48, "hdpi", 72, "xhdpi", 96, "xxhdpi", 144, "xxxhdpi", 192
    );

    public static void main(String[] args) throws Exception {
        Path root = Path.of(args.length == 0 ? "." : args[0]).toAbsolutePath().normalize();
        Path res = root.resolve("android/app/src/main/res");
        for (var entry : LEGACY_SIZES.entrySet()) {
            Path dir = res.resolve("mipmap-" + entry.getKey());
            Files.createDirectories(dir);
            writeLauncher(dir.resolve("ic_launcher.png"), entry.getValue(), false);
            writeLauncher(dir.resolve("ic_launcher_round.png"), entry.getValue(), true);
            writeForeground(dir.resolve("ic_launcher_foreground.png"), Math.round(entry.getValue() * 2.25f));
        }
        try (var paths = Files.walk(res)) {
            paths.filter(path -> path.getFileName().toString().equals("splash.png")).forEach(path -> {
                try { rewriteSplash(path); } catch (IOException error) { throw new RuntimeException(error); }
            });
        }
    }

    private static BufferedImage canvas(int width, int height, boolean transparent) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        graphics.setComposite(AlphaComposite.Src);
        graphics.setColor(transparent ? new Color(0, 0, 0, 0) : Color.BLACK);
        graphics.fillRect(0, 0, width, height);
        graphics.dispose();
        return image;
    }

    private static void writeLauncher(Path path, int size, boolean round) throws IOException {
        BufferedImage image = canvas(size, size, true);
        Graphics2D graphics = image.createGraphics();
        graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        graphics.setColor(Color.BLACK);
        if (round) graphics.fillOval(0, 0, size, size);
        else graphics.fill(new RoundRectangle2D.Double(0, 0, size, size, size * .22, size * .22));
        drawMark(graphics, size * .23, size * .23, size * .54, Color.WHITE);
        graphics.dispose();
        ImageIO.write(image, "png", path.toFile());
    }

    private static void writeForeground(Path path, int size) throws IOException {
        BufferedImage image = canvas(size, size, true);
        Graphics2D graphics = image.createGraphics();
        graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        drawMark(graphics, size * .28, size * .28, size * .44, Color.WHITE);
        graphics.dispose();
        ImageIO.write(image, "png", path.toFile());
    }

    private static void rewriteSplash(Path path) throws IOException {
        BufferedImage current = ImageIO.read(path.toFile());
        if (current == null) return;
        BufferedImage image = canvas(current.getWidth(), current.getHeight(), false);
        Graphics2D graphics = image.createGraphics();
        graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        double size = Math.min(current.getWidth(), current.getHeight()) * .18;
        drawMark(graphics, (current.getWidth() - size) / 2, (current.getHeight() - size) / 2, size, Color.WHITE);
        graphics.dispose();
        ImageIO.write(image, "png", path.toFile());
    }

    private static void drawMark(Graphics2D graphics, double x, double y, double size, Color color) {
        double scale = size / 64.0;
        Path2D.Double d = new Path2D.Double(Path2D.WIND_EVEN_ODD);
        d.moveTo(x + 8 * scale, y + 10 * scale);
        d.lineTo(x + 26 * scale, y + 10 * scale);
        d.curveTo(x + 42 * scale, y + 10 * scale, x + 51 * scale, y + 18.5 * scale, x + 51 * scale, y + 32 * scale);
        d.curveTo(x + 51 * scale, y + 45.5 * scale, x + 42 * scale, y + 54 * scale, x + 26 * scale, y + 54 * scale);
        d.lineTo(x + 8 * scale, y + 54 * scale);
        d.closePath();
        d.moveTo(x + 18 * scale, y + 20 * scale);
        d.lineTo(x + 18 * scale, y + 44 * scale);
        d.lineTo(x + 26 * scale, y + 44 * scale);
        d.curveTo(x + 35.5 * scale, y + 44 * scale, x + 41 * scale, y + 39.6 * scale, x + 41 * scale, y + 32 * scale);
        d.curveTo(x + 41 * scale, y + 24.4 * scale, x + 35.5 * scale, y + 20 * scale, x + 26 * scale, y + 20 * scale);
        d.closePath();
        graphics.setColor(color);
        graphics.fill(d);

        Path2D.Double c = new Path2D.Double();
        c.moveTo(x + 57 * scale, y + 17 * scale);
        c.curveTo(x + 53 * scale, y + 13 * scale, x + 48 * scale, y + 11 * scale, x + 43 * scale, y + 11 * scale);
        c.curveTo(x + 32 * scale, y + 11 * scale, x + 25 * scale, y + 20 * scale, x + 25 * scale, y + 32 * scale);
        c.curveTo(x + 25 * scale, y + 44 * scale, x + 32 * scale, y + 53 * scale, x + 44 * scale, y + 53 * scale);
        c.curveTo(x + 49 * scale, y + 53 * scale, x + 53 * scale, y + 51 * scale, x + 57 * scale, y + 47 * scale);
        graphics.setColor(color);
        graphics.setStroke(new BasicStroke((float) (8 * scale), BasicStroke.CAP_BUTT, BasicStroke.JOIN_ROUND));
        graphics.draw(c);
    }
}
