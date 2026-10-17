package demo;
import java.util.*;
public final class ServiceLoaderLab {
    private ServiceLoaderLab() {}
    public static void main(String[] args) {
        ServiceLoader<TextCodec> loader = ServiceLoader.load(TextCodec.class);
        List<TextCodec> codecs = loader.stream().map(ServiceLoader.Provider::get).toList();
        if (codecs.size() != 1) throw new AssertionError("expected one provider");
        TextCodec codec = codecs.get(0);
        if (!codec.name().equals("upper")) throw new AssertionError("provider name");
        if (!codec.encode("Java").equals("JAVA")) throw new AssertionError("provider invocation");
        loader.reload();
        if (loader.findFirst().isEmpty()) throw new AssertionError("rediscovery");
        System.out.println("PASS ServiceLoaderLab checks=4");
    }
}
