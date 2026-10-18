# Current algorithm shared-source bundle

Java 21; all classes use the default package. The HTML entry pages own the individual topics.

Compile: java -m jdk.compiler/com.sun.tools.javac.Main -encoding UTF-8 -d classes *.java
Run: java -cp classes CodingBoundaryExtrasTest
Run: java -cp classes DoublyListTopicTest
Run: java -cp classes ArrayMissingTest
Run: java -cp classes MinStackTopicTest
Run: java -cp classes CacheLimiterTest
Run: java -cp classes CacheFollowupTest
Run: java -cp classes LfuCurrentContractTest

ArrayMissing contains only the exact current XX substring and weighted-meeting implementations plus Meeting. The historical full ArrayMissing is not shipped.
InterviewCaches is the exact current patched fixture, including empty LFU bucket deletion and bounded TTL cleanup. BaselineInterviewCaches is only the historical differential oracle for CacheFollowupTest. LFUCache is the existing current judge reference used by LfuCurrentContractTest.
MinMaxStackExample adds only an outer compilation wrapper around the existing member. No current 2D rainwater implementation is replaced.

Topic ownership: numeric/frequency TopK remains on entry 215. RecentPlayers is a capacity-bounded distinct arrival-order recency set and belongs to handwrite-47 (LRU variants), alongside clearly separate TTL and time-window contracts. Entry 155 and the concise entry 215 distinction link to that owner. The complete RecentPlayers member appears inline only once.
