// build.rs が OUT_DIR に生成した型定義を取り込む
pub mod manifest {
    include!(concat!(env!("OUT_DIR"), "/manifest.rs"));
}
pub mod article {
    include!(concat!(env!("OUT_DIR"), "/article.rs"));
}
pub mod files {
    include!(concat!(env!("OUT_DIR"), "/files.rs"));
}
