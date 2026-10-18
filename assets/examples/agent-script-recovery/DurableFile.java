import java.io.*;
import java.nio.ByteBuffer;
import java.nio.channels.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;

/** One cooperating writer; local process restart, not replicated or power-loss durable storage. */
public final class DurableFile implements AutoCloseable {
    @FunctionalInterface interface Cleanup {void run()throws IOException;}
    static void cleanup(Throwable primary,Cleanup action)throws IOException {
        try{action.run();}catch(IOException|RuntimeException|Error secondary){
            if(primary==null)throw secondary;
            if(primary!=secondary)primary.addSuppressed(secondary);
        }
    }
    // This standalone program loads this class once. All cooperating opens use this registry.
    // Never open a second channel first: closing it can release another channel's OS lock.
    private static final Object REGISTRY_LOCK=new Object();
    private static final Set<Lease> ACTIVE=Collections.newSetFromMap(new IdentityHashMap<>());
    private record Lease(Path file,Path lockFile,FileChannel channel,FileLock lock) {}
    private final Path file;
    private final Lease lease;
    private boolean poisoned,closed;

    private static boolean regularOrMissing(Path path)throws IOException {
        try {
            if(!Files.readAttributes(path,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS).isRegularFile())
                throw new IOException("store and lock must be regular files, not symbolic links");
            return true;
        }catch(NoSuchFileException absent){return false;}
    }
    private static boolean sameExisting(Path a,Path b)throws IOException {
        // Attribute reads do not open a FileChannel that could disturb an existing OS lock.
        return regularOrMissing(a)&&regularOrMissing(b)&&Files.isSameFile(a,b);
    }
    private static Lease acquire(Path path)throws IOException {
        synchronized(REGISTRY_LOCK) {
            Path absolute=Objects.requireNonNull(path).toAbsolutePath();
            Path name=absolute.getFileName();
            if(name==null||name.toString().equals(".")||name.toString().equals(".."))
                throw new IOException("store must have a file name");
            Files.createDirectories(absolute.getParent());
            Path file=absolute.getParent().toRealPath().resolve(name);
            Path lockFile=file.resolveSibling(name+".lock");
            regularOrMissing(file);regularOrMissing(lockFile);
            if(sameExisting(file,lockFile))throw new IOException("store and lock must be distinct files");
            for(Lease held:ACTIVE) {
                if(file.equals(held.file())||lockFile.equals(held.lockFile())
                    ||file.equals(held.lockFile())||lockFile.equals(held.file())
                    ||sameExisting(file,held.file())||sameExisting(lockFile,held.lockFile())
                    ||sameExisting(file,held.lockFile())||sameExisting(lockFile,held.file()))
                    throw new IOException("another writer in this JVM owns store");
            }
            FileChannel channel=FileChannel.open(lockFile,StandardOpenOption.CREATE,
                    StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS);
            try {
                FileLock lock=channel.tryLock();
                if(lock==null)throw new IOException("another process owns store");
                Lease lease=new Lease(file,lockFile,channel,lock);
                ACTIVE.add(lease);
                return lease;
            }catch(IOException|RuntimeException|Error e){cleanup(e,channel::close);throw e;}
        }
    }
    public DurableFile(Path path)throws IOException {lease=acquire(path);file=lease.file();}
    public synchronized Object read()throws IOException {
        if(poisoned||closed)throw new IOException("store unavailable");
        return Files.exists(file)?StrictJson.read(file):null;
    }
    public synchronized void save(Object data)throws IOException {
        if(poisoned||closed)throw new IOException("store unavailable; restart and inspect");
        byte[] bytes=StrictJson.write(data).getBytes(StandardCharsets.UTF_8);
        if(bytes.length>StrictJson.MAX_BYTES)throw new IOException("snapshot size limit");
        Path temp=Files.createTempFile(file.getParent(),"snapshot-",".tmp");Throwable primary=null;
        try {
            try(FileChannel c=FileChannel.open(temp,StandardOpenOption.WRITE)){ByteBuffer b=ByteBuffer.wrap(bytes);while(b.hasRemaining())c.write(b);c.force(true);}
            // Do not silently fall back to a non-atomic replacement.
            Files.move(temp,file,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
        }catch(IOException|RuntimeException|Error e){primary=e;poisoned=true;throw e;}
        finally {
            try{cleanup(primary,()->Files.deleteIfExists(temp));}
            catch(IOException|RuntimeException|Error e){poisoned=true;throw e;}
        }
    }
    public synchronized void close()throws IOException {
        if(closed&&!lease.channel().isOpen())return;
        closed=true;
        // Do not remove the in-JVM reservation until the old channel is actually closed.
        synchronized(REGISTRY_LOCK) {
            Throwable primary=null;
            try {
                try{if(lease.lock().isValid())lease.lock().release();}
                catch(IOException|RuntimeException|Error e){primary=e;throw e;}
                finally{cleanup(primary,lease.channel()::close);}
            }finally {
                if(!lease.channel().isOpen())ACTIVE.remove(lease);
            }
        }
    }
}
