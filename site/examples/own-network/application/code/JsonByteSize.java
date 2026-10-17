import java.nio.charset.StandardCharsets;

public final class JsonByteSize {
    private JsonByteSize() {}
    public static int utf8Bytes(String serializedJson) {
        return serializedJson.getBytes(StandardCharsets.UTF_8).length;
    }
    public static void main(String[] args) {
        // Fixed serialized texts, not a general JSON serializer.
        String[] json = {"{\"x\":1}", "{\"x\":\"中\"}", "{\"x\":\"\\u4e2d\"}",
                         "{\"x\":\"😀\"}", "{\"x\":\"\\\"\\\\\\n\"}", "{ \"x\": 1 }"};
        int[] expected = {7,11,14,12,14,10};
        for (int i=0;i<json.length;i++) {
            int bytes=utf8Bytes(json[i]);
            if(bytes!=expected[i]) throw new AssertionError(json[i]+": "+bytes);
            System.out.println(json[i]+" -> UTF-8 bytes="+bytes+", Java UTF-16 units="+json[i].length());
        }
        System.out.println("JsonByteSize: 6 fixed-encoding examples passed.");
    }
}
