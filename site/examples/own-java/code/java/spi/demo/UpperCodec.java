package demo;
import java.util.Locale;
import java.util.Objects;
public final class UpperCodec implements TextCodec {
    public UpperCodec() {}
    @Override public String name() { return "upper"; }
    @Override public String encode(String input) {
        return Objects.requireNonNull(input).toUpperCase(Locale.ROOT);
    }
}
