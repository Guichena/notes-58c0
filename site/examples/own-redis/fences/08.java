/** Routing model for an already normalized 11-ASCII-digit namespace, not phone validation. */
public final class PhoneIndexKey {
    private PhoneIndexKey() { }
    public record Address(String key, String field) { }
    private static void validate(String phone) {
        if (phone == null || phone.length() != 11)
            throw new IllegalArgumentException("exactly 11 ASCII digits required");
        for (int i = 0; i < phone.length(); i++)
            if (phone.charAt(i) < '0' || phone.charAt(i) > '9')
                throw new IllegalArgumentException("ASCII digits required");
    }
    public static Address prefixThree(String phone) {
        validate(phone);
        return new Address("phone-index:v1:cn11:prefix3:" + phone.substring(0, 3),
                phone.substring(3));
    }
    /** At most 100 distinct two-digit fields per key within this fixed-format namespace. */
    public static Address boundedHundred(String phone) {
        validate(phone);
        return new Address("phone-index:v1:cn11:prefix9:" + phone.substring(0, 9),
                phone.substring(9));
    }
}
