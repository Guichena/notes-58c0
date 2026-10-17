#include <curl/curl.h>
#include <iostream>
#include <limits>
#include <memory>
#include <stdexcept>
#include <string>

static constexpr std::size_t MAX_BODY = 16384;
static std::size_t receive(char* data, std::size_t size, std::size_t count, void* context) noexcept {
    if (size != 0 && count > std::numeric_limits<std::size_t>::max() / size) return 0;
    const std::size_t bytes = size * count;
    auto& body = *static_cast<std::string*>(context);
    if (bytes > MAX_BODY - body.size()) return 0;
    try { body.append(data, bytes); } catch (...) { return 0; }
    return bytes;
}
int main(int argc, char** argv) {
    if (argc < 2 || argc > 3) { std::cerr << "https_client URL [CA_FILE]\n"; return 2; }
    if (curl_global_init(CURL_GLOBAL_DEFAULT) != CURLE_OK) return 2;
    struct Cleanup { ~Cleanup() { curl_global_cleanup(); } } global;
    std::unique_ptr<CURL, decltype(&curl_easy_cleanup)> easy(curl_easy_init(), curl_easy_cleanup);
    if (!easy) return 2;
    std::string body;
    auto set = [&](CURLoption option, auto value) {
        if (curl_easy_setopt(easy.get(), option, value) != CURLE_OK)
            throw std::runtime_error("setopt failed");
    };
    try {
        set(CURLOPT_URL, argv[1]);
        set(CURLOPT_PROTOCOLS_STR, "https");
        set(CURLOPT_SSL_VERIFYPEER, 1L);
        set(CURLOPT_SSL_VERIFYHOST, 2L);
        if (argc == 3) set(CURLOPT_CAINFO, argv[2]); // Only a deliberately trusted CA bundle.
        set(CURLOPT_CONNECTTIMEOUT_MS, 2000L);
        set(CURLOPT_TIMEOUT_MS, 4000L);
        set(CURLOPT_NOSIGNAL, 1L);
        set(CURLOPT_FOLLOWLOCATION, 0L);
        set(CURLOPT_PROXY, ""); // Deterministic direct-connection teaching example.
        set(CURLOPT_WRITEFUNCTION, &receive);
        set(CURLOPT_WRITEDATA, &body);
        CURLcode result = curl_easy_perform(easy.get());
        if (result != CURLE_OK) { std::cerr << curl_easy_strerror(result) << '\n'; return 1; }
        long status = 0;
        if (curl_easy_getinfo(easy.get(), CURLINFO_RESPONSE_CODE, &status) != CURLE_OK) return 2;
        std::cout << "HTTP " << status << '\n' << body;
        return status >= 200 && status < 300 ? 0 : 1;
    } catch (const std::exception& error) { std::cerr << error.what() << '\n'; return 2; }
}
