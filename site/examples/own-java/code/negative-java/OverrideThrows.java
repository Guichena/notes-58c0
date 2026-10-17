import java.io.IOException;
class BaseNoThrows { void run() {} }
class OverrideThrows extends BaseNoThrows { @Override void run() throws IOException {} }
