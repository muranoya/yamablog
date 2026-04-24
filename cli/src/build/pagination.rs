pub const ARTICLES_PER_PAGE: usize = 10;

pub struct Page<T> {
    pub items: Vec<T>,
    pub page_number: usize,
    pub total_pages: usize,
}

pub fn paginate<T: Clone>(items: &[T], per_page: usize) -> Vec<Page<T>> {
    if items.is_empty() {
        return vec![Page { items: vec![], page_number: 1, total_pages: 1 }];
    }
    let total_pages = items.len().div_ceil(per_page);
    (0..total_pages)
        .map(|i| {
            let start = i * per_page;
            let end = ((i + 1) * per_page).min(items.len());
            Page {
                items: items[start..end].to_vec(),
                page_number: i + 1,
                total_pages,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_paginate_exact() {
        let items: Vec<i32> = (1..=20).collect();
        let pages = paginate(&items, 10);
        assert_eq!(pages.len(), 2);
        assert_eq!(pages[0].items, (1..=10).collect::<Vec<_>>());
        assert_eq!(pages[1].page_number, 2);
        assert_eq!(pages[1].total_pages, 2);
    }

    #[test]
    fn test_paginate_partial_last() {
        let items: Vec<i32> = (1..=15).collect();
        let pages = paginate(&items, 10);
        assert_eq!(pages.len(), 2);
        assert_eq!(pages[1].items.len(), 5);
    }

    #[test]
    fn test_paginate_empty() {
        let items: Vec<i32> = vec![];
        let pages = paginate(&items, 10);
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0].items.len(), 0);
        assert_eq!(pages[0].total_pages, 1);
    }
}
