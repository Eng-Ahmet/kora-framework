//! Lazy Streams and Functional Pipeline Processing for Kora.

/// Lazy stream wrapper enabling functional chain operations.
pub struct Stream<T> {
    items: Vec<T>,
}

impl<T: Clone> Stream<T> {
    pub fn from_vec(items: Vec<T>) -> Self {
        Self { items }
    }

    pub fn filter<F>(self, predicate: F) -> Self
    where
        F: Fn(&T) -> bool,
    {
        Self {
            items: self.items.into_iter().filter(predicate).collect(),
        }
    }

    pub fn map<U, F>(self, transform: F) -> Stream<U>
    where
        F: Fn(T) -> U,
    {
        Stream {
            items: self.items.into_iter().map(transform).collect(),
        }
    }

    pub fn take(self, count: usize) -> Self {
        Self {
            items: self.items.into_iter().take(count).collect(),
        }
    }

    pub fn skip(self, count: usize) -> Self {
        Self {
            items: self.items.into_iter().skip(count).collect(),
        }
    }

    pub fn reduce<U, F>(self, initial: U, accumulator: F) -> U
    where
        F: Fn(U, T) -> U,
    {
        self.items.into_iter().fold(initial, accumulator)
    }

    pub fn collect(self) -> Vec<T> {
        self.items
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stream_pipeline() {
        let res = Stream::from_vec(vec![1, 2, 3, 4, 5, 6])
            .filter(|&x| x % 2 == 0)
            .map(|x| x * 10)
            .take(2)
            .collect();
        assert_eq!(res, vec![20, 40]);
    }
}
