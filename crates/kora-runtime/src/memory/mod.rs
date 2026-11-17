//! Advanced Memory Management and Object Pooling for Kora.

/// Simple Arena allocator allocating objects in a contiguous buffer.
#[derive(Default)]
pub struct Arena<T> {
    storage: Vec<Vec<T>>,
    chunk_size: usize,
}

impl<T> Arena<T> {
    pub fn new(chunk_size: usize) -> Self {
        Self {
            storage: vec![Vec::with_capacity(chunk_size)],
            chunk_size,
        }
    }

    pub fn alloc(&mut self, item: T) -> &mut T {
        if self
            .storage
            .last()
            .map(|c| c.len() >= self.chunk_size)
            .unwrap_or(true)
        {
            self.storage.push(Vec::with_capacity(self.chunk_size));
        }
        let chunk = self.storage.last_mut().unwrap();
        chunk.push(item);
        chunk.last_mut().unwrap()
    }

    pub fn total_allocated(&self) -> usize {
        self.storage.iter().map(Vec::len).sum()
    }

    pub fn clear(&mut self) {
        self.storage.clear();
        self.storage.push(Vec::with_capacity(self.chunk_size));
    }
}

/// Reusable Object Pool to eliminate dynamic allocation overhead in high-throughput loops.
pub struct ObjectPool<T> {
    pool: Vec<T>,
    factory: Box<dyn Fn() -> T + Send + Sync>,
}

impl<T> ObjectPool<T> {
    pub fn new<F>(factory: F) -> Self
    where
        F: Fn() -> T + Send + Sync + 'static,
    {
        Self {
            pool: Vec::new(),
            factory: Box::new(factory),
        }
    }

    pub fn acquire(&mut self) -> T {
        self.pool.pop().unwrap_or_else(|| (self.factory)())
    }

    pub fn release(&mut self, item: T) {
        self.pool.push(item);
    }

    pub fn size(&self) -> usize {
        self.pool.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_arena_allocation() {
        let mut arena = Arena::new(4);
        for i in 0..10 {
            arena.alloc(i * 10);
        }
        assert_eq!(arena.total_allocated(), 10);
    }

    #[test]
    fn test_object_pool() {
        let mut pool = ObjectPool::new(|| String::with_capacity(128));
        let mut s = pool.acquire();
        s.push_str("cached buffer");
        s.clear();
        pool.release(s);
        assert_eq!(pool.size(), 1);
        let s2 = pool.acquire();
        assert_eq!(s2.capacity(), 128);
    }
}
