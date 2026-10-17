import javax.crypto.spec.SecretKeySpec;

public final class BadCrypto {
    public SecretKeySpec key() {
        // Deliberately public test data, not a real credential.
        return new SecretKeySpec("0123456789abcdef".getBytes(java.nio.charset.StandardCharsets.UTF_8), "AES");
    }
}
