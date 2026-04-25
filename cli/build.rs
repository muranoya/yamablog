use std::path::Path;
use typify::{TypeSpace, TypeSpaceSettings};

fn generate_schema(schema_path: &Path, out_file: &str, out_dir: &str) {
    let json = std::fs::read_to_string(schema_path)
        .unwrap_or_else(|e| panic!("cannot read {}: {e}", schema_path.display()));
    let schema: schemars::schema::RootSchema = serde_json::from_str(&json)
        .unwrap_or_else(|e| panic!("invalid JSON Schema {}: {e}", schema_path.display()));

    let settings = TypeSpaceSettings::default();
    let mut type_space = TypeSpace::new(&settings);
    type_space
        .add_root_schema(schema)
        .unwrap_or_else(|e| panic!("typify error for {}: {e}", schema_path.display()));

    let tokens = type_space.to_stream();
    let file: syn::File = syn::parse2(tokens)
        .unwrap_or_else(|e| panic!("syn parse error for {}: {e}", schema_path.display()));
    let code = prettyplease::unparse(&file);

    let out_path = Path::new(out_dir).join(out_file);
    std::fs::write(&out_path, code)
        .unwrap_or_else(|e| panic!("cannot write {}: {e}", out_path.display()));

    println!("cargo:rerun-if-changed={}", schema_path.display());
}

fn main() {
    println!("cargo:rerun-if-changed=build.rs");

    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let schema_dir = Path::new(&manifest_dir).join("..").join("schema");
    let out_dir = std::env::var("OUT_DIR").unwrap();

    generate_schema(
        &schema_dir.join("manifest.schema.json"),
        "manifest.rs",
        &out_dir,
    );
    generate_schema(
        &schema_dir.join("article.schema.json"),
        "article.rs",
        &out_dir,
    );
    generate_schema(&schema_dir.join("files.schema.json"), "files.rs", &out_dir);
}
