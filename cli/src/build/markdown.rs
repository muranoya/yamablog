use pulldown_cmark::{html, Options, Parser};

pub fn markdown_to_html(md: &str) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    let parser = Parser::new_ext(md, options);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);
    html_output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_heading() {
        let html = markdown_to_html("# Hello");
        assert!(html.contains("<h1>Hello</h1>"));
    }

    #[test]
    fn test_paragraph() {
        let html = markdown_to_html("Hello world");
        assert!(html.contains("<p>Hello world</p>"));
    }

    #[test]
    fn test_strong() {
        let html = markdown_to_html("**bold**");
        assert!(html.contains("<strong>bold</strong>"));
    }
}
