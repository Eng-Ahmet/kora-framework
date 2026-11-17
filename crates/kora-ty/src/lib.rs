//! Strong static type system, bidirectional type inference, interface conformance,
//! pattern exhaustiveness, and compile-time Dependency Injection verification for Kora.

#![allow(clippy::collapsible_if)]

use std::collections::{HashMap, HashSet};
use std::fmt;

use kora_ast::{
    BinaryOp, Block, ClassDecl, ClosureBody, ClosureParam, ElseBranch, EnumDecl, Expr, FieldDecl,
    FnDecl, FnSig, InterfaceDecl, Item, MatchArm, ModelDecl, Pattern, Stmt, StructDecl, TypeExpr,
    UnaryOp,
};
use kora_diagnostics::{Diagnostic, DiagnosticBag};
use kora_hir::HirModule;
use kora_span::Span;

/// Canonical static type representation in Kora.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Ty {
    // Numeric Primitives
    Int,
    Int8,
    Int16,
    Int32,
    Int64,
    UInt,
    UInt8,
    UInt16,
    UInt32,
    UInt64,
    Float,
    Float32,
    Float64,
    Decimal,
    // Primitives
    Bool,
    Char,
    Byte,
    String,
    Unit,
    Never,

    // Backend / Builtin Objects
    Database,
    App,
    Request,
    Response,
    Headers,

    // Sequential Collections
    Array(Box<Ty>),
    Vector(Box<Ty>),
    VecDeque(Box<Ty>),
    LinkedList(Box<Ty>),
    Stack(Box<Ty>),
    Queue(Box<Ty>),
    CircularBuffer(Box<Ty>),
    Matrix(Box<Ty>),
    Tensor(Box<Ty>),
    List(Box<Ty>),

    // Associative Collections
    Map(Box<Ty>, Box<Ty>),
    HashMap(Box<Ty>, Box<Ty>),
    BTreeMap(Box<Ty>, Box<Ty>),
    OrderedMap(Box<Ty>, Box<Ty>),
    MultiMap(Box<Ty>, Box<Ty>),
    BiMap(Box<Ty>, Box<Ty>),

    // Sets
    Set(Box<Ty>),
    HashSet(Box<Ty>),
    BTreeSet(Box<Ty>),
    OrderedSet(Box<Ty>),
    BitSet,
    MultiSet(Box<Ty>),

    // Specialized Collections
    PriorityQueue(Box<Ty>),
    BinaryHeap(Box<Ty>),
    Trie(Box<Ty>),
    Graph(Box<Ty>),
    DirectedGraph(Box<Ty>),
    UndirectedGraph(Box<Ty>),
    WeightedGraph(Box<Ty>),
    DisjointSet(Box<Ty>),
    BloomFilter(Box<Ty>),
    LRUCache(Box<Ty>, Box<Ty>),
    LFUCache(Box<Ty>, Box<Ty>),
    RingBuffer(Box<Ty>),

    // Algebraic / Composite / Concurrency
    Tuple(Vec<Ty>),
    Option(Box<Ty>),
    Result(Box<Ty>, Box<Ty>),
    Either(Box<Ty>, Box<Ty>),
    Range(Box<Ty>),
    Channel(Box<Ty>),
    Mutex(Box<Ty>),
    RwLock(Box<Ty>),

    // Nominal Types
    Struct(String),
    Model(String),
    Class(String),
    Interface(String),
    Enum(String),
    Fn {
        params: Vec<Ty>,
        ret: Box<Ty>,
        is_async: bool,
    },

    // Type-level receivers & Generic constructors
    MetaModel(String),
    MetaEnum(String),
    MetaClass(String),
    MetaResponse,
    MetaType(String, Vec<Ty>),

    Unknown,
}

impl fmt::Display for Ty {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Int => write!(f, "Int"),
            Self::Int8 => write!(f, "Int8"),
            Self::Int16 => write!(f, "Int16"),
            Self::Int32 => write!(f, "Int32"),
            Self::Int64 => write!(f, "Int64"),
            Self::UInt => write!(f, "UInt"),
            Self::UInt8 => write!(f, "UInt8"),
            Self::UInt16 => write!(f, "UInt16"),
            Self::UInt32 => write!(f, "UInt32"),
            Self::UInt64 => write!(f, "UInt64"),
            Self::Float => write!(f, "Float"),
            Self::Float32 => write!(f, "Float32"),
            Self::Float64 => write!(f, "Float64"),
            Self::Decimal => write!(f, "Decimal"),
            Self::Bool => write!(f, "Bool"),
            Self::Char => write!(f, "Char"),
            Self::Byte => write!(f, "Byte"),
            Self::String => write!(f, "String"),
            Self::Unit => write!(f, "Unit"),
            Self::Never => write!(f, "Never"),
            Self::Database => write!(f, "Database"),
            Self::App => write!(f, "App"),
            Self::Request => write!(f, "Request"),
            Self::Response => write!(f, "Response"),
            Self::Headers => write!(f, "Headers"),
            Self::Array(inner) => write!(f, "Array<{inner}>"),
            Self::Vector(inner) => write!(f, "Vector<{inner}>"),
            Self::VecDeque(inner) => write!(f, "VecDeque<{inner}>"),
            Self::LinkedList(inner) => write!(f, "LinkedList<{inner}>"),
            Self::Stack(inner) => write!(f, "Stack<{inner}>"),
            Self::Queue(inner) => write!(f, "Queue<{inner}>"),
            Self::CircularBuffer(inner) => write!(f, "CircularBuffer<{inner}>"),
            Self::Matrix(inner) => write!(f, "Matrix<{inner}>"),
            Self::Tensor(inner) => write!(f, "Tensor<{inner}>"),
            Self::List(inner) => write!(f, "List<{inner}>"),
            Self::Map(k, v) => write!(f, "Map<{k}, {v}>"),
            Self::HashMap(k, v) => write!(f, "HashMap<{k}, {v}>"),
            Self::BTreeMap(k, v) => write!(f, "BTreeMap<{k}, {v}>"),
            Self::OrderedMap(k, v) => write!(f, "OrderedMap<{k}, {v}>"),
            Self::MultiMap(k, v) => write!(f, "MultiMap<{k}, {v}>"),
            Self::BiMap(k, v) => write!(f, "BiMap<{k}, {v}>"),
            Self::Set(inner) => write!(f, "Set<{inner}>"),
            Self::HashSet(inner) => write!(f, "HashSet<{inner}>"),
            Self::BTreeSet(inner) => write!(f, "BTreeSet<{inner}>"),
            Self::OrderedSet(inner) => write!(f, "OrderedSet<{inner}>"),
            Self::BitSet => write!(f, "BitSet"),
            Self::MultiSet(inner) => write!(f, "MultiSet<{inner}>"),
            Self::PriorityQueue(inner) => write!(f, "PriorityQueue<{inner}>"),
            Self::BinaryHeap(inner) => write!(f, "BinaryHeap<{inner}>"),
            Self::Trie(inner) => write!(f, "Trie<{inner}>"),
            Self::Graph(inner) => write!(f, "Graph<{inner}>"),
            Self::DirectedGraph(inner) => write!(f, "DirectedGraph<{inner}>"),
            Self::UndirectedGraph(inner) => write!(f, "UndirectedGraph<{inner}>"),
            Self::WeightedGraph(inner) => write!(f, "WeightedGraph<{inner}>"),
            Self::DisjointSet(inner) => write!(f, "DisjointSet<{inner}>"),
            Self::BloomFilter(inner) => write!(f, "BloomFilter<{inner}>"),
            Self::LRUCache(k, v) => write!(f, "LRUCache<{k}, {v}>"),
            Self::LFUCache(k, v) => write!(f, "LFUCache<{k}, {v}>"),
            Self::RingBuffer(inner) => write!(f, "RingBuffer<{inner}>"),
            Self::Option(inner) => write!(f, "Option<{inner}>"),
            Self::Result(ok, err) => write!(f, "Result<{ok}, {err}>"),
            Self::Either(l, r) => write!(f, "Either<{l}, {r}>"),
            Self::Range(inner) => write!(f, "Range<{inner}>"),
            Self::Channel(inner) => write!(f, "Channel<{inner}>"),
            Self::Mutex(inner) => write!(f, "Mutex<{inner}>"),
            Self::RwLock(inner) => write!(f, "RwLock<{inner}>"),
            Self::Tuple(types) => {
                let parts: Vec<String> = types.iter().map(|t| t.to_string()).collect();
                write!(f, "({})", parts.join(", "))
            }
            Self::Struct(n)
            | Self::Model(n)
            | Self::Class(n)
            | Self::Interface(n)
            | Self::Enum(n) => write!(f, "{n}"),
            Self::MetaModel(n) => write!(f, "model {n}"),
            Self::MetaEnum(n) => write!(f, "enum {n}"),
            Self::MetaClass(n) => write!(f, "class {n}"),
            Self::MetaResponse => write!(f, "Response"),
            Self::MetaType(n, _) => write!(f, "type {n}"),
            Self::Fn {
                params,
                ret,
                is_async,
            } => {
                if *is_async {
                    write!(f, "async ")?;
                }
                write!(f, "(")?;
                for (i, p) in params.iter().enumerate() {
                    if i > 0 {
                        write!(f, ", ")?;
                    }
                    write!(f, "{p}")?;
                }
                write!(f, ") -> {ret}")
            }
            Self::Unknown => write!(f, "_"),
        }
    }
}

impl Ty {
    pub fn contains_unknown(&self) -> bool {
        match self {
            Self::Unknown => true,
            Self::Array(t)
            | Self::Vector(t)
            | Self::VecDeque(t)
            | Self::LinkedList(t)
            | Self::Stack(t)
            | Self::Queue(t)
            | Self::CircularBuffer(t)
            | Self::Matrix(t)
            | Self::Tensor(t)
            | Self::List(t)
            | Self::Set(t)
            | Self::HashSet(t)
            | Self::BTreeSet(t)
            | Self::OrderedSet(t)
            | Self::MultiSet(t)
            | Self::PriorityQueue(t)
            | Self::BinaryHeap(t)
            | Self::Trie(t)
            | Self::Graph(t)
            | Self::DirectedGraph(t)
            | Self::UndirectedGraph(t)
            | Self::WeightedGraph(t)
            | Self::DisjointSet(t)
            | Self::BloomFilter(t)
            | Self::RingBuffer(t)
            | Self::Option(t)
            | Self::Range(t)
            | Self::Channel(t)
            | Self::Mutex(t)
            | Self::RwLock(t) => t.contains_unknown(),
            Self::Map(k, v)
            | Self::HashMap(k, v)
            | Self::BTreeMap(k, v)
            | Self::OrderedMap(k, v)
            | Self::MultiMap(k, v)
            | Self::BiMap(k, v)
            | Self::LRUCache(k, v)
            | Self::LFUCache(k, v)
            | Self::Result(k, v)
            | Self::Either(k, v) => k.contains_unknown() || v.contains_unknown(),
            Self::Tuple(ts) => ts.iter().any(Self::contains_unknown),
            Self::Fn { params, ret, .. } => {
                params.iter().any(Self::contains_unknown) || ret.contains_unknown()
            }
            _ => false,
        }
    }

    pub fn is_meta(&self) -> bool {
        matches!(
            self,
            Self::MetaModel(_)
                | Self::MetaEnum(_)
                | Self::MetaClass(_)
                | Self::MetaResponse
                | Self::MetaType(_, _)
        )
    }
}

#[derive(Debug, Clone)]
pub struct FunctionTypeInfo {
    pub name: String,
    pub params: Vec<(String, Ty)>,
    pub ret: Ty,
    pub is_async: bool,
    pub span: Span,
}

#[derive(Debug, Clone)]
pub struct ClassTypeInfo {
    pub name: String,
    pub implements: Vec<String>,
    pub fields: HashMap<String, Ty>,
    pub init_params: Vec<(String, Ty)>,
    pub methods: HashMap<String, FunctionTypeInfo>,
}

#[derive(Debug, Clone)]
pub struct InferredBinding {
    pub scope: String,
    pub name: String,
    pub mutable: bool,
    pub ty: Ty,
    pub span: Span,
}

/// Complete output of `kora-ty` static verification.
#[derive(Debug, Clone)]
pub struct TypeCheckOutput {
    pub structs: HashMap<String, HashMap<String, Ty>>,
    pub models: HashMap<String, HashMap<String, Ty>>,
    pub entity_models: HashSet<String>,
    pub model_tables: HashMap<String, String>,
    pub interfaces: HashMap<String, HashMap<String, FunctionTypeInfo>>,
    pub classes: HashMap<String, ClassTypeInfo>,
    pub enums: HashMap<String, Vec<(String, Vec<Ty>)>>,
    pub functions: HashMap<String, FunctionTypeInfo>,
    pub bindings: Vec<InferredBinding>,
}

/// Executes full static type checking, type inference, interface conformance, and DI validation.
pub fn check_module(hir: &HirModule, diagnostics: &mut DiagnosticBag) -> TypeCheckOutput {
    let mut checker = TypeChecker::new(diagnostics);
    checker.collect_declarations(hir);
    checker.verify_interfaces_and_di(hir);
    checker.check_bodies(hir);

    TypeCheckOutput {
        structs: checker.structs,
        models: checker.models,
        entity_models: checker.entity_models,
        model_tables: checker.model_tables,
        interfaces: checker.interfaces,
        classes: checker.classes,
        enums: checker.enums,
        functions: checker.functions,
        bindings: checker.recorded_bindings,
    }
}

struct TypeChecker<'a> {
    structs: HashMap<String, HashMap<String, Ty>>,
    models: HashMap<String, HashMap<String, Ty>>,
    entity_models: HashSet<String>,
    model_tables: HashMap<String, String>,
    interfaces: HashMap<String, HashMap<String, FunctionTypeInfo>>,
    classes: HashMap<String, ClassTypeInfo>,
    enums: HashMap<String, Vec<(String, Vec<Ty>)>>,
    functions: HashMap<String, FunctionTypeInfo>,
    scopes: Vec<HashMap<String, Ty>>,
    current_class: Option<String>,
    current_return_ty: Option<Ty>,
    current_scope_label: String,
    recorded_bindings: Vec<InferredBinding>,
    diagnostics: &'a mut DiagnosticBag,
}

impl<'a> TypeChecker<'a> {
    fn new(diagnostics: &'a mut DiagnosticBag) -> Self {
        Self {
            structs: HashMap::new(),
            models: HashMap::new(),
            entity_models: HashSet::new(),
            model_tables: HashMap::new(),
            interfaces: HashMap::new(),
            classes: HashMap::new(),
            enums: HashMap::new(),
            functions: HashMap::new(),
            scopes: vec![HashMap::new()],
            current_class: None,
            current_return_ty: None,
            current_scope_label: "<top-level>".to_string(),
            recorded_bindings: Vec::new(),
            diagnostics,
        }
    }

    fn collect_declarations(&mut self, hir: &HirModule) {
        // First register nominal type names so recursive/cross references resolve cleanly.
        for item in &hir.ast.items {
            match item {
                Item::Struct(StructDecl { name, .. }) => {
                    self.structs.entry(name.name.clone()).or_default();
                }
                Item::Model(ModelDecl { name, .. }) => {
                    self.models.entry(name.name.clone()).or_default();
                }
                Item::Interface(InterfaceDecl { name, .. }) => {
                    self.interfaces.entry(name.name.clone()).or_default();
                }
                Item::Class(ClassDecl { name, .. }) => {
                    self.classes.insert(
                        name.name.clone(),
                        ClassTypeInfo {
                            name: name.name.clone(),
                            implements: Vec::new(),
                            fields: HashMap::new(),
                            init_params: Vec::new(),
                            methods: HashMap::new(),
                        },
                    );
                }
                Item::Enum(EnumDecl { name, .. }) => {
                    self.enums.entry(name.name.clone()).or_default();
                }
                _ => {}
            }
        }

        // Populate fields, variants, method signatures, and top-level function signatures.
        for item in &hir.ast.items {
            match item {
                Item::Struct(s) => {
                    let map = self.lower_fields(&s.fields);
                    self.structs.insert(s.name.name.clone(), map);
                }
                Item::Model(m) => {
                    let map = self.lower_fields(&m.fields);
                    self.models.insert(m.name.name.clone(), map);

                    let has_entity_attr = m
                        .attributes
                        .iter()
                        .any(|a| a.name.name == "entity" || a.name.name == "table");
                    let has_field_primary = m.fields.iter().any(|f| {
                        f.attributes
                            .iter()
                            .any(|a| a.name.name == "primary" || a.name.name == "autoIncrement")
                    });
                    let is_entity_name = m.name.name.ends_with("Entity");

                    if has_entity_attr || has_field_primary || is_entity_name {
                        self.entity_models.insert(m.name.name.clone());
                        let mut custom_table = None;
                        for attr in &m.attributes {
                            if let ("table", Some(kora_ast::Expr::StringLit { value, .. })) =
                                (attr.name.name.as_str(), attr.args.first())
                            {
                                custom_table = Some(value.clone());
                            }
                        }
                        let tbl = custom_table.unwrap_or_else(|| {
                            let base = m.name.name.trim_end_matches("Entity");
                            format!("{}s", base.to_lowercase())
                        });
                        self.model_tables.insert(m.name.name.clone(), tbl);
                    }
                }
                Item::Interface(iface) => {
                    let mut methods = HashMap::new();
                    for sig in &iface.methods {
                        let info = self.lower_fn_sig(sig);
                        methods.insert(sig.name.name.clone(), info);
                    }
                    self.interfaces.insert(iface.name.name.clone(), methods);
                }
                Item::Class(cls) => {
                    let fields = self.lower_fields(&cls.fields);
                    let implements = cls.implements.iter().map(|i| i.name.clone()).collect();
                    let init_params = cls
                        .init
                        .as_ref()
                        .map(|init| {
                            init.params
                                .iter()
                                .map(|p| (p.name.name.clone(), self.lower_type_expr(&p.ty)))
                                .collect()
                        })
                        .unwrap_or_default();
                    let mut methods = HashMap::new();
                    for m in &cls.methods {
                        let info = self.lower_fn_sig(&m.sig);
                        methods.insert(m.sig.name.name.clone(), info);
                    }
                    self.classes.insert(
                        cls.name.name.clone(),
                        ClassTypeInfo {
                            name: cls.name.name.clone(),
                            implements,
                            fields,
                            init_params,
                            methods,
                        },
                    );
                }
                Item::Enum(en) => {
                    let variants = en
                        .variants
                        .iter()
                        .map(|v| {
                            let payload =
                                v.payload.iter().map(|t| self.lower_type_expr(t)).collect();
                            (v.name.name.clone(), payload)
                        })
                        .collect();
                    self.enums.insert(en.name.name.clone(), variants);
                }
                Item::Fn(func) => {
                    let info = self.lower_fn_sig(&func.sig);
                    self.functions.insert(func.sig.name.name.clone(), info);
                }
                Item::Stmt(_) => {}
                Item::ModuleDecl(_) | Item::Import(_) | Item::Extend(_) => {}
            }
        }
    }

    fn lower_fields(&mut self, fields: &[FieldDecl]) -> HashMap<String, Ty> {
        let mut out = HashMap::new();
        for f in fields {
            out.insert(f.name.name.clone(), self.lower_type_expr(&f.ty));
        }
        out
    }

    fn lower_fn_sig(&mut self, sig: &FnSig) -> FunctionTypeInfo {
        let params = sig
            .params
            .iter()
            .map(|p| (p.name.name.clone(), self.lower_type_expr(&p.ty)))
            .collect();
        let ret = sig
            .return_ty
            .as_ref()
            .map(|t| self.lower_type_expr(t))
            .unwrap_or(Ty::Unit);
        FunctionTypeInfo {
            name: sig.name.name.clone(),
            params,
            ret,
            is_async: sig.is_async,
            span: sig.span,
        }
    }

    fn lower_type_expr(&mut self, texpr: &TypeExpr) -> Ty {
        match texpr {
            TypeExpr::Named {
                name,
                args,
                span: _,
            } => match name.name.as_str() {
                "Int" => Ty::Int,
                "Int8" | "i8" => Ty::Int8,
                "Int16" | "i16" => Ty::Int16,
                "Int32" | "i32" => Ty::Int32,
                "Int64" | "i64" => Ty::Int64,
                "UInt" | "uint" => Ty::UInt,
                "UInt8" | "u8" | "Byte" | "byte" => Ty::UInt8,
                "UInt16" | "u16" => Ty::UInt16,
                "UInt32" | "u32" => Ty::UInt32,
                "UInt64" | "u64" => Ty::UInt64,
                "Float" => Ty::Float,
                "Float32" | "f32" => Ty::Float32,
                "Float64" | "f64" => Ty::Float64,
                "Decimal" => Ty::Decimal,
                "Bool" => Ty::Bool,
                "Char" => Ty::Char,
                "String" => Ty::String,
                "Unit" | "void" => Ty::Unit,
                "Never" => Ty::Never,
                "Database" => Ty::Database,
                "App" | "Router" => Ty::App,
                "Request" => Ty::Request,
                "Response" => Ty::Response,
                "Headers" => Ty::Headers,

                "Vector" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::Vector(Box::new(elem))
                }
                "Array" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::Array(Box::new(elem))
                }
                "List" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::List(Box::new(elem))
                }
                "VecDeque" | "Deque" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::VecDeque(Box::new(elem))
                }
                "LinkedList" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::LinkedList(Box::new(elem))
                }
                "Stack" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::Stack(Box::new(elem))
                }
                "Queue" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::Queue(Box::new(elem))
                }
                "CircularBuffer" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::CircularBuffer(Box::new(elem))
                }
                "Matrix" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::Matrix(Box::new(elem))
                }
                "Tensor" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::Tensor(Box::new(elem))
                }

                "Map" => {
                    let k = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    let v = args
                        .get(1)
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::Map(Box::new(k), Box::new(v))
                }
                "HashMap" => {
                    let k = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    let v = args
                        .get(1)
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::HashMap(Box::new(k), Box::new(v))
                }
                "BTreeMap" => {
                    let k = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    let v = args
                        .get(1)
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::BTreeMap(Box::new(k), Box::new(v))
                }
                "OrderedMap" => {
                    let k = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    let v = args
                        .get(1)
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::OrderedMap(Box::new(k), Box::new(v))
                }
                "MultiMap" => {
                    let k = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    let v = args
                        .get(1)
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::MultiMap(Box::new(k), Box::new(v))
                }
                "BiMap" => {
                    let k = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    let v = args
                        .get(1)
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::BiMap(Box::new(k), Box::new(v))
                }

                "Set" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::Set(Box::new(elem))
                }
                "HashSet" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::HashSet(Box::new(elem))
                }
                "BTreeSet" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::BTreeSet(Box::new(elem))
                }
                "OrderedSet" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::OrderedSet(Box::new(elem))
                }
                "BitSet" => Ty::BitSet,
                "MultiSet" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::MultiSet(Box::new(elem))
                }

                "PriorityQueue" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::PriorityQueue(Box::new(elem))
                }
                "BinaryHeap" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::BinaryHeap(Box::new(elem))
                }
                "Trie" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::Trie(Box::new(elem))
                }
                "Graph" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::Graph(Box::new(elem))
                }
                "DirectedGraph" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::DirectedGraph(Box::new(elem))
                }
                "UndirectedGraph" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::UndirectedGraph(Box::new(elem))
                }
                "WeightedGraph" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::WeightedGraph(Box::new(elem))
                }
                "DisjointSet" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::DisjointSet(Box::new(elem))
                }
                "BloomFilter" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::BloomFilter(Box::new(elem))
                }
                "LRUCache" | "LruCache" => {
                    let k = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    let v = args
                        .get(1)
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::LRUCache(Box::new(k), Box::new(v))
                }
                "LFUCache" | "LfuCache" => {
                    let k = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    let v = args
                        .get(1)
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::LFUCache(Box::new(k), Box::new(v))
                }
                "RingBuffer" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::RingBuffer(Box::new(elem))
                }

                "Option" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::Option(Box::new(elem))
                }
                "Result" => {
                    let ok = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    let err = args
                        .get(1)
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::Result(Box::new(ok), Box::new(err))
                }
                "Either" => {
                    let l = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    let r = args
                        .get(1)
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::Either(Box::new(l), Box::new(r))
                }
                "Range" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::Range(Box::new(elem))
                }
                "Tuple" => {
                    let parts = args.iter().map(|a| self.lower_type_expr(a)).collect();
                    Ty::Tuple(parts)
                }
                "Channel" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::Channel(Box::new(elem))
                }
                "Mutex" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::Mutex(Box::new(elem))
                }
                "RwLock" => {
                    let elem = args
                        .first()
                        .map(|a| self.lower_type_expr(a))
                        .unwrap_or(Ty::Unknown);
                    Ty::RwLock(Box::new(elem))
                }

                custom => {
                    if self.structs.contains_key(custom) {
                        Ty::Struct(custom.to_string())
                    } else if self.models.contains_key(custom) {
                        Ty::Model(custom.to_string())
                    } else if self.classes.contains_key(custom) {
                        Ty::Class(custom.to_string())
                    } else if self.interfaces.contains_key(custom) {
                        Ty::Interface(custom.to_string())
                    } else if self.enums.contains_key(custom) {
                        Ty::Enum(custom.to_string())
                    } else {
                        Ty::Unknown
                    }
                }
            },
            TypeExpr::Function { params, ret, .. } => Ty::Fn {
                params: params.iter().map(|p| self.lower_type_expr(p)).collect(),
                ret: Box::new(self.lower_type_expr(ret)),
                is_async: false,
            },
        }
    }

    #[allow(dead_code)]
    fn expect_arity(&mut self, name: &str, args: &[TypeExpr], expected: usize, span: Span) -> bool {
        if args.len() == expected {
            true
        } else {
            self.diagnostics.emit(
                Diagnostic::error(
                    "E4003",
                    format!(
                        "type `{name}` expects {expected} generic type argument(s), found {}",
                        args.len()
                    ),
                )
                .with_primary_label(span, "incorrect generic type arity"),
            );
            false
        }
    }

    fn verify_interfaces_and_di(&mut self, hir: &HirModule) {
        for item in &hir.ast.items {
            let Item::Class(cls) = item else {
                continue;
            };
            let Some(cls_info) = self.classes.get(&cls.name.name).cloned() else {
                continue;
            };

            // 1. Verify compile-time DI constructor (`init`) parameters are injectable.
            if let Some(init) = &cls.init {
                for (param_ast, (_, pty)) in init.params.iter().zip(cls_info.init_params.iter()) {
                    if !Self::is_di_injectable(pty) && *pty != Ty::Unknown {
                        self.diagnostics.emit(
                            Diagnostic::error(
                                "E4012",
                                format!(
                                    "class `{}` constructor parameter `{}` has non-injectable type `{pty}`",
                                    cls.name.name, param_ast.name.name
                                ),
                            )
                            .with_primary_label(
                                param_ast.span,
                                "DI `init` parameters must be a service `class`, `interface`, or `Database`",
                            ),
                        );
                    }
                }
            }

            // 2. Verify every declared `interface` contract is satisfied.
            for iface_ident in &cls.implements {
                let Some(iface_methods) = self.interfaces.get(&iface_ident.name).cloned() else {
                    continue;
                };
                for (mname, req_sig) in &iface_methods {
                    let Some(impl_sig) = cls_info.methods.get(mname) else {
                        self.diagnostics.emit(
                            Diagnostic::error(
                                "E4008",
                                format!(
                                    "class `{}` is missing method `{mname}` required by interface `{}`",
                                    cls.name.name, iface_ident.name
                                ),
                            )
                            .with_primary_label(
                                cls.name.span,
                                format!("missing implementation of `{mname}`"),
                            )
                            .with_secondary_label(req_sig.span, format!("`{mname}` declared here")),
                        );
                        continue;
                    };

                    let params_match = req_sig.params.len() == impl_sig.params.len()
                        && req_sig
                            .params
                            .iter()
                            .zip(impl_sig.params.iter())
                            .all(|((_, a), (_, b))| a == b);
                    let ret_matches = req_sig.ret == impl_sig.ret;
                    let async_matches = req_sig.is_async == impl_sig.is_async;

                    if !params_match || !ret_matches || !async_matches {
                        self.diagnostics.emit(
                            Diagnostic::error(
                                "E4009",
                                format!(
                                    "method `{}.{mname}` has incompatible signature for interface `{}`",
                                    cls.name.name, iface_ident.name
                                ),
                            )
                            .with_primary_label(
                                impl_sig.span,
                                "method signature does not match interface contract",
                            )
                            .with_secondary_label(req_sig.span, "expected signature declared here"),
                        );
                    }
                }
            }
        }
    }

    fn is_di_injectable(ty: &Ty) -> bool {
        matches!(ty, Ty::Class(_) | Ty::Interface(_) | Ty::Database | Ty::App)
    }

    fn check_bodies(&mut self, hir: &HirModule) {
        for item in &hir.ast.items {
            match item {
                Item::Class(cls) => {
                    self.current_class = Some(cls.name.name.clone());
                    if let Some(init) = &cls.init {
                        let cls_info = self.classes[&cls.name.name].clone();
                        self.push_scope();
                        self.current_scope_label = format!("{}.init", cls.name.name);
                        self.current_return_ty = Some(Ty::Unit);
                        for (pname, pty) in &cls_info.init_params {
                            self.define_local(pname.clone(), pty.clone());
                        }
                        self.check_block(&init.body);
                        self.current_return_ty = None;
                        self.pop_scope();
                    }
                    for method in &cls.methods {
                        let sig =
                            self.classes[&cls.name.name].methods[&method.sig.name.name].clone();
                        self.check_fn_decl(
                            method,
                            &sig,
                            &format!("{}.{}", cls.name.name, sig.name),
                        );
                    }
                    self.current_class = None;
                }
                Item::Fn(func) => {
                    let sig = self.functions[&func.sig.name.name].clone();
                    self.check_fn_decl(func, &sig, &sig.name.clone());
                }
                Item::Stmt(stmt) => {
                    self.current_scope_label = "<top-level>".to_string();
                    self.check_stmt(stmt);
                }
                Item::Struct(_) | Item::Model(_) | Item::Interface(_) | Item::Enum(_) => {}
                Item::ModuleDecl(_) | Item::Import(_) | Item::Extend(_) => {}
            }
        }
    }

    fn check_fn_decl(&mut self, func: &FnDecl, sig: &FunctionTypeInfo, scope_label: &str) {
        self.push_scope();
        self.current_scope_label = scope_label.to_string();
        self.current_return_ty = Some(sig.ret.clone());

        for (pname, pty) in &sig.params {
            self.define_local(pname.clone(), pty.clone());
        }

        self.check_block(&func.body);

        if sig.ret != Ty::Unit && !sig.ret.contains_unknown() && !block_always_returns(&func.body) {
            self.diagnostics.emit(
                Diagnostic::error(
                    "E4011",
                    format!(
                        "function `{}` declares return type `{}`, but not all paths return a value",
                        sig.name, sig.ret
                    ),
                )
                .with_primary_label(
                    func.sig.span,
                    format!("expected `{}` return on all paths", sig.ret),
                ),
            );
        }

        self.current_return_ty = None;
        self.pop_scope();
    }

    fn check_block(&mut self, block: &Block) {
        for stmt in &block.stmts {
            self.check_stmt(stmt);
        }
    }

    fn check_stmt(&mut self, stmt: &Stmt) {
        match stmt {
            Stmt::Let {
                name,
                mutable,
                ty,
                value,
                span,
            } => {
                let declared_ty = ty.as_ref().map(|t| self.lower_type_expr(t));
                let inferred_rhs = self.check_expr(value, declared_ty.as_ref());

                if inferred_rhs.is_meta() {
                    self.diagnostics.emit(
                        Diagnostic::error(
                            "E4001",
                            format!("cannot bind type name `{inferred_rhs}` as a runtime value"),
                        )
                        .with_primary_label(value.span(), "expected a value expression"),
                    );
                }

                let final_ty = if let Some(expected) = declared_ty {
                    if !self.is_assignable(&expected, &inferred_rhs) {
                        self.emit_type_mismatch(&expected, &inferred_rhs, value.span());
                    }
                    expected
                } else {
                    if inferred_rhs.contains_unknown() && inferred_rhs != Ty::Unknown {
                        self.diagnostics.emit(
                            Diagnostic::error(
                                "E4002",
                                format!(
                                    "cannot infer complete static type `{inferred_rhs}` for `{}` without annotation",
                                    name.name
                                ),
                            )
                            .with_primary_label(*span, "add an explicit type annotation here")
                            .with_help(format!("try `let {}: <Type> = ...`", name.name)),
                        );
                    }
                    inferred_rhs
                };

                self.recorded_bindings.push(InferredBinding {
                    scope: self.current_scope_label.clone(),
                    name: name.name.clone(),
                    mutable: *mutable,
                    ty: final_ty.clone(),
                    span: name.span,
                });
                self.define_local(name.name.clone(), final_ty);
            }
            Stmt::Return { value, span } => {
                let expected = self.current_return_ty.clone().unwrap_or(Ty::Unit);
                match value {
                    Some(expr) => {
                        let actual = self.check_expr(expr, Some(&expected));
                        if self.current_return_ty.is_some()
                            && !self.is_assignable(&expected, &actual)
                        {
                            self.emit_type_mismatch(&expected, &actual, expr.span());
                        }
                    }
                    None => {
                        if self.current_return_ty.is_some() && expected != Ty::Unit {
                            self.emit_type_mismatch(&expected, &Ty::Unit, *span);
                        }
                    }
                }
            }
            Stmt::If {
                cond,
                then_branch,
                else_branch,
                ..
            } => {
                let cond_ty = self.check_expr(cond, Some(&Ty::Bool));
                if !self.is_assignable(&Ty::Bool, &cond_ty) {
                    self.emit_type_mismatch(&Ty::Bool, &cond_ty, cond.span());
                }
                self.push_scope();
                self.check_block(then_branch);
                self.pop_scope();
                if let Some(eb) = else_branch {
                    match eb {
                        ElseBranch::Block(blk) => {
                            self.push_scope();
                            self.check_block(blk);
                            self.pop_scope();
                        }
                        ElseBranch::If(nested) => self.check_stmt(nested),
                    }
                }
            }
            Stmt::While { cond, body, .. } => {
                let cond_ty = self.check_expr(cond, Some(&Ty::Bool));
                if !self.is_assignable(&Ty::Bool, &cond_ty) {
                    self.emit_type_mismatch(&Ty::Bool, &cond_ty, cond.span());
                }
                self.push_scope();
                self.check_block(body);
                self.pop_scope();
            }
            Stmt::Const {
                name,
                ty,
                value,
                span: _,
            } => {
                let declared_ty = ty.as_ref().map(|t| self.lower_type_expr(t));
                let inferred_rhs = self.check_expr(value, declared_ty.as_ref());
                let final_ty = if let Some(expected) = declared_ty {
                    if !self.is_assignable(&expected, &inferred_rhs) {
                        self.emit_type_mismatch(&expected, &inferred_rhs, value.span());
                    }
                    expected
                } else {
                    inferred_rhs
                };
                self.recorded_bindings.push(InferredBinding {
                    scope: self.current_scope_label.clone(),
                    name: name.name.clone(),
                    mutable: false,
                    ty: final_ty.clone(),
                    span: name.span,
                });
                self.define_local(name.name.clone(), final_ty);
            }
            Stmt::For {
                var, iter, body, ..
            } => {
                let iter_ty = self.check_expr(iter, None);
                let elem_ty = match iter_ty {
                    Ty::Vector(inner)
                    | Ty::Array(inner)
                    | Ty::List(inner)
                    | Ty::VecDeque(inner)
                    | Ty::LinkedList(inner)
                    | Ty::Set(inner)
                    | Ty::HashSet(inner)
                    | Ty::BTreeSet(inner)
                    | Ty::OrderedSet(inner)
                    | Ty::MultiSet(inner)
                    | Ty::Range(inner) => *inner,
                    Ty::Map(k, _)
                    | Ty::HashMap(k, _)
                    | Ty::BTreeMap(k, _)
                    | Ty::OrderedMap(k, _) => *k,
                    _ => Ty::Int,
                };
                self.push_scope();
                self.define_local(var.name.clone(), elem_ty);
                self.check_block(body);
                self.pop_scope();
            }
            Stmt::Break { .. } | Stmt::Continue { .. } => {}
            Stmt::CompoundAssign { target, value, .. } => {
                let target_ty = self.check_expr(target, None);
                let _ = self.check_expr(value, Some(&target_ty));
            }
            Stmt::Throw { value, .. } => {
                let _ = self.check_expr(value, None);
            }
            Stmt::TryCatch {
                try_block,
                catch_param,
                catch_block,
                finally_block,
                ..
            } => {
                self.push_scope();
                self.check_block(try_block);
                self.pop_scope();

                self.push_scope();
                if let Some(param) = catch_param {
                    self.define_local(param.name.clone(), Ty::String);
                }
                self.check_block(catch_block);
                self.pop_scope();

                if let Some(fin) = finally_block {
                    self.push_scope();
                    self.check_block(fin);
                    self.pop_scope();
                }
            }
            Stmt::Expr { expr, .. } => {
                let _ = self.check_expr(expr, None);
            }
        }
    }

    fn check_expr(&mut self, expr: &Expr, expected: Option<&Ty>) -> Ty {
        match expr {
            Expr::IntLit { .. } => match expected {
                Some(
                    t @ (Ty::Int
                    | Ty::Int8
                    | Ty::Int16
                    | Ty::Int32
                    | Ty::Int64
                    | Ty::UInt
                    | Ty::UInt8
                    | Ty::UInt16
                    | Ty::UInt32
                    | Ty::UInt64),
                ) => (*t).clone(),
                _ => Ty::Int,
            },
            Expr::FloatLit { .. } => match expected {
                Some(t @ (Ty::Float | Ty::Float32 | Ty::Float64 | Ty::Decimal)) => (*t).clone(),
                _ => Ty::Float,
            },
            Expr::StringLit { .. } => Ty::String,
            Expr::CharLit { .. } => Ty::Char,
            Expr::BoolLit { .. } => Ty::Bool,
            Expr::Null { .. } => {
                if let Some(Ty::Option(inner)) = expected {
                    Ty::Option(inner.clone())
                } else {
                    Ty::Option(Box::new(Ty::Unknown))
                }
            }
            Expr::This { .. } => self
                .current_class
                .as_ref()
                .map(|c| Ty::Class(c.clone()))
                .unwrap_or(Ty::Unknown),
            Expr::Ident(id) => {
                if let Some(local_ty) = self.lookup_local(&id.name) {
                    return local_ty.clone();
                }
                if id.name == "None" {
                    if let Some(Ty::Option(inner)) = expected {
                        return Ty::Option(inner.clone());
                    }
                    return Ty::Option(Box::new(Ty::Unknown));
                }
                if id.name == "Response" {
                    return Ty::MetaResponse;
                }
                if id.name == "App" || id.name == "Router" {
                    return Ty::Fn {
                        params: Vec::new(),
                        ret: Box::new(Ty::App),
                        is_async: false,
                    };
                }
                if let Some(fn_info) = self.functions.get(&id.name) {
                    return Ty::Fn {
                        params: fn_info.params.iter().map(|(_, t)| t.clone()).collect(),
                        ret: Box::new(fn_info.ret.clone()),
                        is_async: fn_info.is_async,
                    };
                }
                if self.classes.contains_key(&id.name) {
                    return Ty::MetaClass(id.name.clone());
                }
                if self.models.contains_key(&id.name) {
                    return Ty::MetaModel(id.name.clone());
                }
                if self.enums.contains_key(&id.name) {
                    return Ty::MetaEnum(id.name.clone());
                }
                Ty::Unknown
            }
            Expr::Unary {
                op, expr: inner, ..
            } => {
                let inner_ty = self.check_expr(inner, None);
                match op {
                    UnaryOp::Not => {
                        if !self.is_assignable(&Ty::Bool, &inner_ty) {
                            self.emit_type_mismatch(&Ty::Bool, &inner_ty, inner.span());
                        }
                        Ty::Bool
                    }
                    UnaryOp::Neg => {
                        if inner_ty != Ty::Int && inner_ty != Ty::Float && inner_ty != Ty::Unknown {
                            self.diagnostics.emit(
                                Diagnostic::error(
                                    "E4001",
                                    format!(
                                        "unary `-` requires `Int` or `Float`, found `{inner_ty}`"
                                    ),
                                )
                                .with_primary_label(inner.span(), "expected numeric value"),
                            );
                            Ty::Unknown
                        } else {
                            inner_ty
                        }
                    }
                }
            }
            Expr::Binary { op, lhs, rhs, span } => {
                let lty = self.check_expr(lhs, None);
                let rty = self.check_expr(rhs, Some(&lty));
                self.check_binary_op(*op, &lty, &rty, *span)
            }
            Expr::Assign { target, value, .. } => {
                let target_ty = self.check_expr(target, None);
                let val_ty = self.check_expr(value, Some(&target_ty));
                if !self.is_assignable(&target_ty, &val_ty) {
                    self.emit_type_mismatch(&target_ty, &val_ty, value.span());
                }
                Ty::Unit
            }
            Expr::StructLit { name, fields, span } => {
                let (expected_fields, out_ty) = if let Some(sf) = self.structs.get(&name.name) {
                    (sf.clone(), Ty::Struct(name.name.clone()))
                } else if let Some(mf) = self.models.get(&name.name) {
                    (mf.clone(), Ty::Model(name.name.clone()))
                } else {
                    self.diagnostics.emit(
                        Diagnostic::error(
                            "E4004",
                            format!("`{}` is not a `struct` or `model`", name.name),
                        )
                        .with_primary_label(name.span, "cannot instantiate with `{ ... }` literal"),
                    );
                    return Ty::Unknown;
                };

                let mut seen = HashSet::new();
                for init in fields {
                    if !seen.insert(init.name.name.clone()) {
                        self.diagnostics.emit(
                            Diagnostic::error(
                                "E4006",
                                format!(
                                    "field `{}` initialized more than once in `{}`",
                                    init.name.name, name.name
                                ),
                            )
                            .with_primary_label(init.name.span, "duplicate field initializer"),
                        );
                        continue;
                    }
                    match expected_fields.get(&init.name.name) {
                        Some(field_ty) => {
                            let vty = self.check_expr(&init.value, Some(field_ty));
                            if !self.is_assignable(field_ty, &vty) {
                                self.emit_type_mismatch(field_ty, &vty, init.value.span());
                            }
                        }
                        None => {
                            let _ = self.check_expr(&init.value, None);
                            self.diagnostics.emit(
                                Diagnostic::error(
                                    "E4005",
                                    format!(
                                        "unknown field `{}` on `{}`",
                                        init.name.name, name.name
                                    ),
                                )
                                .with_primary_label(init.name.span, "field does not exist"),
                            );
                        }
                    }
                }

                for req_field in expected_fields.keys() {
                    if !seen.contains(req_field) {
                        self.diagnostics.emit(
                            Diagnostic::error(
                                "E4004",
                                format!(
                                    "missing required field `{req_field}` in `{}` literal",
                                    name.name
                                ),
                            )
                            .with_primary_label(*span, format!("missing `{req_field}`")),
                        );
                    }
                }

                out_ty
            }
            Expr::ListLit { elements, span } => {
                let expected_elem = match expected {
                    Some(Ty::Array(inner) | Ty::Vector(inner) | Ty::List(inner)) => {
                        Some(inner.as_ref())
                    }
                    _ => None,
                };
                if elements.is_empty() {
                    let elem = expected_elem.cloned().unwrap_or(Ty::Unknown);
                    return match expected {
                        Some(Ty::Vector(_)) => Ty::Vector(Box::new(elem)),
                        Some(Ty::List(_)) => Ty::List(Box::new(elem)),
                        _ => Ty::Array(Box::new(elem)),
                    };
                }
                let first_ty = self.check_expr(&elements[0], expected_elem);
                for el in &elements[1..] {
                    let ety = self.check_expr(el, Some(&first_ty));
                    if !self.is_assignable(&first_ty, &ety) {
                        self.diagnostics.emit(
                            Diagnostic::error(
                                "E4001",
                                format!(
                                    "heterogeneous list element: expected `{first_ty}`, found `{ety}`"
                                ),
                            )
                            .with_primary_label(*span, "all list elements must share the same type"),
                        );
                    }
                }
                match expected {
                    Some(Ty::Vector(_)) => Ty::Vector(Box::new(first_ty)),
                    Some(Ty::List(_)) => Ty::List(Box::new(first_ty)),
                    _ => Ty::Array(Box::new(first_ty)),
                }
            }
            Expr::TypeConstructor {
                name, type_args, ..
            } => {
                let lowered: Vec<Ty> = type_args.iter().map(|t| self.lower_type_expr(t)).collect();
                Ty::MetaType(name.name.clone(), lowered)
            }
            Expr::CollectionLit {
                constructor,
                elements,
                span,
            } => {
                let target_ty = if let Some(c) = constructor {
                    self.check_expr(c, None)
                } else {
                    Ty::Unknown
                };

                let elem_exp = match &target_ty {
                    Ty::Vector(inner)
                    | Ty::Array(inner)
                    | Ty::List(inner)
                    | Ty::Set(inner)
                    | Ty::HashSet(inner)
                    | Ty::Stack(inner)
                    | Ty::Queue(inner)
                    | Ty::PriorityQueue(inner) => Some(inner.as_ref()),
                    Ty::MetaType(_, args) => args.first(),
                    _ => match expected {
                        Some(
                            Ty::Vector(inner)
                            | Ty::Array(inner)
                            | Ty::List(inner)
                            | Ty::Set(inner)
                            | Ty::HashSet(inner),
                        ) => Some(inner.as_ref()),
                        _ => None,
                    },
                };

                let elem_ty = if elements.is_empty() {
                    elem_exp.cloned().unwrap_or(Ty::Unknown)
                } else {
                    let first = self.check_expr(&elements[0], elem_exp);
                    for el in &elements[1..] {
                        let ety = self.check_expr(el, Some(&first));
                        if !self.is_assignable(&first, &ety) {
                            self.diagnostics.emit(
                                Diagnostic::error(
                                    "E4001",
                                    format!("heterogeneous element in collection: expected `{first}`, found `{ety}`"),
                                )
                                .with_primary_label(*span, "all collection elements must share the same type"),
                            );
                        }
                    }
                    first
                };

                match &target_ty {
                    Ty::MetaType(name, _) => match name.as_str() {
                        "Vector" => Ty::Vector(Box::new(elem_ty)),
                        "Array" => Ty::Array(Box::new(elem_ty)),
                        "Set" | "HashSet" => Ty::Set(Box::new(elem_ty)),
                        "BTreeSet" => Ty::BTreeSet(Box::new(elem_ty)),
                        "Stack" => Ty::Stack(Box::new(elem_ty)),
                        "Queue" => Ty::Queue(Box::new(elem_ty)),
                        "PriorityQueue" => Ty::PriorityQueue(Box::new(elem_ty)),
                        _ => Ty::Vector(Box::new(elem_ty)),
                    },
                    Ty::Vector(_) => Ty::Vector(Box::new(elem_ty)),
                    Ty::Array(_) => Ty::Array(Box::new(elem_ty)),
                    Ty::Set(_) => Ty::Set(Box::new(elem_ty)),
                    Ty::HashSet(_) => Ty::HashSet(Box::new(elem_ty)),
                    _ => match expected {
                        Some(Ty::Vector(_)) => Ty::Vector(Box::new(elem_ty)),
                        Some(Ty::Set(_)) => Ty::Set(Box::new(elem_ty)),
                        _ => Ty::Array(Box::new(elem_ty)),
                    },
                }
            }
            Expr::MapLit { entries, span: _ } => {
                if entries.is_empty() {
                    return Ty::HashMap(Box::new(Ty::Unknown), Box::new(Ty::Unknown));
                }
                let k0 = self.check_expr(&entries[0].0, None);
                let v0 = self.check_expr(&entries[0].1, None);
                for (k, v) in &entries[1..] {
                    let k_ty = self.check_expr(k, Some(&k0));
                    let v_ty = self.check_expr(v, Some(&v0));
                    if !self.is_assignable(&k0, &k_ty) {
                        self.diagnostics.emit(
                            Diagnostic::error(
                                "E4001",
                                format!("heterogeneous map key: expected `{k0}`, found `{k_ty}`"),
                            )
                            .with_primary_label(k.span(), "all map keys must share the same type"),
                        );
                    }
                    if !self.is_assignable(&v0, &v_ty) {
                        self.diagnostics.emit(
                            Diagnostic::error(
                                "E4001",
                                format!("heterogeneous map value: expected `{v0}`, found `{v_ty}`"),
                            )
                            .with_primary_label(
                                v.span(),
                                "all map values must share the same type",
                            ),
                        );
                    }
                }
                Ty::HashMap(Box::new(k0), Box::new(v0))
            }
            Expr::FieldAccess {
                receiver, field, ..
            } => {
                let recv_ty = self.check_expr(receiver, None);
                self.check_field_access(&recv_ty, &field.name, field.span)
            }
            Expr::Index {
                receiver, index, ..
            } => {
                let recv_ty = self.check_expr(receiver, None);
                let idx_ty = self.check_expr(index, None);
                match recv_ty {
                    Ty::Vector(inner)
                    | Ty::Array(inner)
                    | Ty::List(inner)
                    | Ty::VecDeque(inner)
                    | Ty::Matrix(inner) => {
                        if !self.is_assignable(&Ty::Int, &idx_ty) {
                            self.emit_type_mismatch(&Ty::Int, &idx_ty, index.span());
                        }
                        *inner
                    }
                    Ty::Map(k, v)
                    | Ty::HashMap(k, v)
                    | Ty::BTreeMap(k, v)
                    | Ty::OrderedMap(k, v) => {
                        if !self.is_assignable(&k, &idx_ty) {
                            self.emit_type_mismatch(&k, &idx_ty, index.span());
                        }
                        *v
                    }
                    Ty::Request | Ty::Headers | Ty::Database | Ty::Unknown => Ty::String,
                    other => {
                        self.diagnostics.emit(
                            Diagnostic::error(
                                "E4001",
                                format!("cannot index into value of type `{other}`"),
                            )
                            .with_primary_label(receiver.span(), "cannot index this type"),
                        );
                        Ty::Unknown
                    }
                }
            }
            Expr::Call { callee, args, span } => self.check_call(callee, args, expected, *span),
            Expr::Closure {
                params,
                return_ty,
                body,
                span,
            } => self.check_closure(params, return_ty.as_ref(), body, expected, *span),
            Expr::Match {
                scrutinee,
                arms,
                span,
            } => self.check_match(scrutinee, arms, expected, *span),
            Expr::Await { expr: inner, .. } => self.check_expr(inner, expected),
        }
    }

    fn check_binary_op(&mut self, op: BinaryOp, lty: &Ty, rty: &Ty, span: Span) -> Ty {
        if *lty == Ty::Unknown || *rty == Ty::Unknown {
            return match op {
                BinaryOp::Eq
                | BinaryOp::Neq
                | BinaryOp::Lt
                | BinaryOp::Lte
                | BinaryOp::Gt
                | BinaryOp::Gte
                | BinaryOp::And
                | BinaryOp::Or => Ty::Bool,
                _ => Ty::Unknown,
            };
        }

        match op {
            BinaryOp::Add => {
                if *lty == Ty::Int && *rty == Ty::Int {
                    Ty::Int
                } else if *lty == Ty::Float && *rty == Ty::Float {
                    Ty::Float
                } else if *lty == Ty::String && *rty == Ty::String {
                    Ty::String
                } else {
                    self.emit_binary_error(op, lty, rty, span);
                    Ty::Unknown
                }
            }
            BinaryOp::Sub | BinaryOp::Mul | BinaryOp::Div | BinaryOp::Mod => {
                if *lty == Ty::Int && *rty == Ty::Int {
                    Ty::Int
                } else if *lty == Ty::Float && *rty == Ty::Float && op != BinaryOp::Mod {
                    Ty::Float
                } else {
                    self.emit_binary_error(op, lty, rty, span);
                    Ty::Unknown
                }
            }
            BinaryOp::Lt | BinaryOp::Lte | BinaryOp::Gt | BinaryOp::Gte => {
                if (*lty == Ty::Int && *rty == Ty::Int) || (*lty == Ty::Float && *rty == Ty::Float)
                {
                    Ty::Bool
                } else {
                    self.emit_binary_error(op, lty, rty, span);
                    Ty::Bool
                }
            }
            BinaryOp::Eq | BinaryOp::Neq => {
                if self.is_assignable(lty, rty) || self.is_assignable(rty, lty) {
                    Ty::Bool
                } else {
                    self.emit_binary_error(op, lty, rty, span);
                    Ty::Bool
                }
            }
            BinaryOp::And | BinaryOp::Or => {
                if *lty == Ty::Bool && *rty == Ty::Bool {
                    Ty::Bool
                } else {
                    self.emit_binary_error(op, lty, rty, span);
                    Ty::Bool
                }
            }
            BinaryOp::Coalesce => match lty {
                Ty::Option(inner) => {
                    if self.is_assignable(inner, rty) {
                        (**inner).clone()
                    } else {
                        self.emit_binary_error(op, lty, rty, span);
                        (**inner).clone()
                    }
                }
                _ => lty.clone(),
            },
            BinaryOp::Pipe => match rty {
                Ty::Fn { ret, .. } => (**ret).clone(),
                _ => rty.clone(),
            },
            BinaryOp::Range => {
                if *lty == Ty::Int && *rty == Ty::Int {
                    Ty::List(Box::new(Ty::Int))
                } else {
                    self.emit_binary_error(op, lty, rty, span);
                    Ty::List(Box::new(Ty::Int))
                }
            }
        }
    }

    fn emit_binary_error(&mut self, op: BinaryOp, lty: &Ty, rty: &Ty, span: Span) {
        self.diagnostics.emit(
            Diagnostic::error(
                "E4001",
                format!(
                    "cannot apply operator `{}` to `{lty}` and `{rty}`",
                    op.symbol()
                ),
            )
            .with_primary_label(span, "incompatible operand types"),
        );
    }

    fn check_field_access(&mut self, recv_ty: &Ty, field: &str, span: Span) -> Ty {
        match recv_ty {
            Ty::Unknown => Ty::Unknown,
            Ty::Struct(s) => self.lookup_member_field(s, &self.structs.clone(), field, span),
            Ty::Model(m) => self.lookup_member_field(m, &self.models.clone(), field, span),
            Ty::Class(c) => {
                if let Some(cls) = self.classes.get(c) {
                    if let Some(fty) = cls.fields.get(field) {
                        return fty.clone();
                    }
                    if let Some(m) = cls.methods.get(field) {
                        return Ty::Fn {
                            params: m.params.iter().map(|(_, t)| t.clone()).collect(),
                            ret: Box::new(m.ret.clone()),
                            is_async: m.is_async,
                        };
                    }
                }
                self.emit_unknown_member(recv_ty, field, span)
            }
            Ty::Interface(iface) => {
                if let Some(methods) = self.interfaces.get(iface)
                    && let Some(m) = methods.get(field)
                {
                    return Ty::Fn {
                        params: m.params.iter().map(|(_, t)| t.clone()).collect(),
                        ret: Box::new(m.ret.clone()),
                        is_async: m.is_async,
                    };
                }
                self.emit_unknown_member(recv_ty, field, span)
            }
            Ty::MetaModel(m) => match field {
                "all" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::List(Box::new(Ty::Model(m.clone())))),
                    is_async: false,
                },
                "find" => Ty::Fn {
                    params: vec![Ty::Int],
                    ret: Box::new(Ty::Option(Box::new(Ty::Model(m.clone())))),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::MetaEnum(en) => {
                if let Some(variants) = self.enums.get(en)
                    && let Some((_, payload)) = variants.iter().find(|(vn, _)| vn == field)
                {
                    if payload.is_empty() {
                        return Ty::Enum(en.clone());
                    }
                    return Ty::Fn {
                        params: payload.clone(),
                        ret: Box::new(Ty::Enum(en.clone())),
                        is_async: false,
                    };
                }
                self.emit_unknown_member(recv_ty, field, span)
            }
            Ty::MetaClass(cls) => {
                if let Some(cls_info) = self.classes.get(cls)
                    && let Some(m) = cls_info.methods.get(field)
                {
                    let ty = Ty::Fn {
                        params: m.params.iter().map(|(_, t)| t.clone()).collect(),
                        ret: Box::new(m.ret.clone()),
                        is_async: m.is_async,
                    };
                    return ty;
                }
                self.emit_unknown_member(recv_ty, field, span)
            }
            Ty::MetaResponse => match field {
                "json" | "ok" | "created" | "error" | "badRequest" | "unauthorized"
                | "forbidden" | "notFound" | "internalError" | "status" | "text" => Ty::Fn {
                    params: vec![Ty::Unknown],
                    ret: Box::new(Ty::Response),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::App => match field {
                "use" => Ty::Fn {
                    params: vec![Ty::Unknown],
                    ret: Box::new(Ty::App),
                    is_async: false,
                },
                "get" | "post" | "put" | "delete" | "patch" => Ty::Fn {
                    params: vec![Ty::String, Ty::Unknown],
                    ret: Box::new(Ty::App),
                    is_async: false,
                },
                "listen" => Ty::Fn {
                    params: vec![Ty::Int],
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::Request => match field {
                "path" | "body" | "method" | "ip" | "url" => Ty::String,
                "params" => Ty::Request,
                "headers" => Ty::Headers,
                "header" => Ty::Fn {
                    params: vec![Ty::String],
                    ret: Box::new(Ty::Option(Box::new(Ty::String))),
                    is_async: false,
                },
                "param" => Ty::Fn {
                    params: vec![Ty::String],
                    ret: Box::new(Ty::String),
                    is_async: false,
                },
                "query" => Ty::Fn {
                    params: vec![Ty::String],
                    ret: Box::new(Ty::Option(Box::new(Ty::String))),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::Headers => match field {
                "get" => Ty::Fn {
                    params: vec![Ty::String],
                    ret: Box::new(Ty::Option(Box::new(Ty::String))),
                    is_async: false,
                },
                "has" => Ty::Fn {
                    params: vec![Ty::String],
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "set" => Ty::Fn {
                    params: vec![Ty::String, Ty::String],
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::Response => match field {
                "statusCode" => Ty::Int,
                "body" => Ty::String,
                "status" => Ty::Fn {
                    params: vec![Ty::Int],
                    ret: Box::new(Ty::Response),
                    is_async: false,
                },
                "json" | "text" => Ty::Fn {
                    params: vec![Ty::Unknown],
                    ret: Box::new(Ty::Response),
                    is_async: false,
                },
                "header" => Ty::Fn {
                    params: vec![Ty::String, Ty::String],
                    ret: Box::new(Ty::Response),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::Database => match field {
                "query" | "execute" | "executeRaw" | "queryOne" | "queryMany" => Ty::Fn {
                    params: vec![Ty::String],
                    ret: Box::new(Ty::Result(Box::new(Ty::Int), Box::new(Ty::String))),
                    is_async: false,
                },
                "collection" => Ty::Fn {
                    params: vec![Ty::String],
                    ret: Box::new(Ty::Database),
                    is_async: false,
                },
                "findUnique" | "findFirst" => Ty::Fn {
                    params: vec![Ty::String, Ty::String],
                    ret: Box::new(Ty::Option(Box::new(Ty::Unknown))),
                    is_async: false,
                },
                "findMany" => Ty::Fn {
                    params: vec![Ty::String, Ty::String],
                    ret: Box::new(Ty::List(Box::new(Ty::Unknown))),
                    is_async: false,
                },
                "isConnected" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "begin" | "commit" | "rollback" | "close" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "create" | "insert" | "update" | "delete" | "save" | "getPresence" => Ty::Fn {
                    params: vec![Ty::Unknown],
                    ret: Box::new(Ty::Unknown),
                    is_async: false,
                },
                // NoSQL Document Store Methods
                "insertOne" | "insertMany" => Ty::Fn {
                    params: vec![Ty::Unknown],
                    ret: Box::new(Ty::String),
                    is_async: false,
                },
                "findOne" => Ty::Fn {
                    params: vec![Ty::Unknown],
                    ret: Box::new(Ty::Option(Box::new(Ty::Unknown))),
                    is_async: false,
                },
                "find" => Ty::Fn {
                    params: vec![Ty::Unknown],
                    ret: Box::new(Ty::List(Box::new(Ty::Unknown))),
                    is_async: false,
                },
                "updateOne" | "updateMany" => Ty::Fn {
                    params: vec![Ty::Unknown, Ty::Unknown],
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "deleteOne" | "deleteMany" => Ty::Fn {
                    params: vec![Ty::Unknown],
                    ret: Box::new(Ty::Int),
                    is_async: false,
                },
                "countDocuments" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Int),
                    is_async: false,
                },
                "createIndex" => Ty::Fn {
                    params: vec![Ty::String],
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                // KeyValue & In-Memory Redis Cache Methods
                "get" => Ty::Fn {
                    params: vec![Ty::String],
                    ret: Box::new(Ty::Option(Box::new(Ty::String))),
                    is_async: false,
                },
                "set" => Ty::Fn {
                    params: vec![Ty::String, Ty::Unknown],
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "setEx" => Ty::Fn {
                    params: vec![Ty::String, Ty::Unknown, Ty::Int],
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "del" | "exists" | "expire" => Ty::Fn {
                    params: vec![Ty::String],
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "incr" | "decr" | "llen" => Ty::Fn {
                    params: vec![Ty::String],
                    ret: Box::new(Ty::Int),
                    is_async: false,
                },
                "hget" => Ty::Fn {
                    params: vec![Ty::String, Ty::String],
                    ret: Box::new(Ty::Option(Box::new(Ty::String))),
                    is_async: false,
                },
                "hset" => Ty::Fn {
                    params: vec![Ty::String, Ty::String, Ty::Unknown],
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "lpush" | "rpush" => Ty::Fn {
                    params: vec![Ty::String, Ty::Unknown],
                    ret: Box::new(Ty::Int),
                    is_async: false,
                },
                "lpop" | "rpop" => Ty::Fn {
                    params: vec![Ty::String],
                    ret: Box::new(Ty::Option(Box::new(Ty::String))),
                    is_async: false,
                },
                // Dynamic collection / repository table access (e.g. database.users, database.quizzes, database.cache)
                _ => Ty::Database,
            },
            Ty::String => match field {
                "len" | "length" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Int),
                    is_async: false,
                },
                "contains" | "startsWith" | "endsWith" => Ty::Fn {
                    params: vec![Ty::String],
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "trim" | "toLower" | "toUpper" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::String),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::Int => match field {
                "toString" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::String),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::Float => match field {
                "toString" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::String),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::Vector(elem)
            | Ty::Array(elem)
            | Ty::List(elem)
            | Ty::VecDeque(elem)
            | Ty::LinkedList(elem) => match field {
                "len" | "length" | "count" | "size" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Int),
                    is_async: false,
                },
                "isEmpty" | "is_empty" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "contains" => Ty::Fn {
                    params: vec![*elem.clone()],
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "push" | "push_back" => Ty::Fn {
                    params: vec![*elem.clone()],
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                "push_front" => Ty::Fn {
                    params: vec![*elem.clone()],
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                "pop" | "pop_back" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Option(elem.clone())),
                    is_async: false,
                },
                "pop_front" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Option(elem.clone())),
                    is_async: false,
                },
                "get" => Ty::Fn {
                    params: vec![Ty::Int],
                    ret: Box::new(Ty::Option(elem.clone())),
                    is_async: false,
                },
                "set" | "insert" => Ty::Fn {
                    params: vec![Ty::Int, *elem.clone()],
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                "remove" => Ty::Fn {
                    params: vec![Ty::Int],
                    ret: Box::new(Ty::Option(elem.clone())),
                    is_async: false,
                },
                "first" | "last" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Option(elem.clone())),
                    is_async: false,
                },
                "capacity" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Int),
                    is_async: false,
                },
                "clear" | "reverse" | "sort" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                "filter" => Ty::Fn {
                    params: vec![Ty::Unknown],
                    ret: Box::new(recv_ty.clone()),
                    is_async: false,
                },
                "map" => Ty::Fn {
                    params: vec![Ty::Unknown],
                    ret: Box::new(Ty::Vector(Box::new(Ty::Unknown))),
                    is_async: false,
                },
                "reduce" => Ty::Fn {
                    params: vec![Ty::Unknown, Ty::Unknown],
                    ret: Box::new(Ty::Unknown),
                    is_async: false,
                },
                "to_vector" | "to_array" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Vector(elem.clone())),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::Stack(elem) => match field {
                "push" => Ty::Fn {
                    params: vec![*elem.clone()],
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                "pop" | "peek" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Option(elem.clone())),
                    is_async: false,
                },
                "len" | "length" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Int),
                    is_async: false,
                },
                "isEmpty" | "is_empty" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "clear" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::Queue(elem) | Ty::CircularBuffer(elem) | Ty::RingBuffer(elem) => match field {
                "enqueue" | "push" => Ty::Fn {
                    params: vec![*elem.clone()],
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                "dequeue" | "pop" | "peek" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Option(elem.clone())),
                    is_async: false,
                },
                "len" | "length" | "capacity" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Int),
                    is_async: false,
                },
                "isEmpty" | "is_empty" | "is_full" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "clear" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::Map(k, v)
            | Ty::HashMap(k, v)
            | Ty::BTreeMap(k, v)
            | Ty::OrderedMap(k, v)
            | Ty::MultiMap(k, v)
            | Ty::BiMap(k, v) => match field {
                "insert" => Ty::Fn {
                    params: vec![*k.clone(), *v.clone()],
                    ret: Box::new(Ty::Option(v.clone())),
                    is_async: false,
                },
                "get" | "remove" => Ty::Fn {
                    params: vec![*k.clone()],
                    ret: Box::new(Ty::Option(v.clone())),
                    is_async: false,
                },
                "contains_key" | "containsKey" => Ty::Fn {
                    params: vec![*k.clone()],
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "contains_value" | "containsValue" => Ty::Fn {
                    params: vec![*v.clone()],
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "keys" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Vector(k.clone())),
                    is_async: false,
                },
                "values" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Vector(v.clone())),
                    is_async: false,
                },
                "len" | "length" | "size" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Int),
                    is_async: false,
                },
                "isEmpty" | "is_empty" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "clear" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::BitSet => match field {
                "insert" | "set" | "remove" | "contains" | "test" => Ty::Fn {
                    params: vec![Ty::Int],
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "len" | "size" | "capacity" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Int),
                    is_async: false,
                },
                "clear" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::Set(elem)
            | Ty::HashSet(elem)
            | Ty::BTreeSet(elem)
            | Ty::OrderedSet(elem)
            | Ty::MultiSet(elem) => match field {
                "insert" | "add" | "remove" | "contains" | "has" => Ty::Fn {
                    params: vec![*elem.clone()],
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "union" | "intersection" | "difference" | "symmetric_difference" => Ty::Fn {
                    params: vec![recv_ty.clone()],
                    ret: Box::new(recv_ty.clone()),
                    is_async: false,
                },
                "is_subset" | "is_superset" => Ty::Fn {
                    params: vec![recv_ty.clone()],
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "isEmpty" | "is_empty" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "count" => Ty::Fn {
                    params: vec![*elem.clone()],
                    ret: Box::new(Ty::Int),
                    is_async: false,
                },
                "len" | "length" | "size" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Int),
                    is_async: false,
                },
                "clear" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                "to_vector" | "to_vec" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Vector(elem.clone())),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::PriorityQueue(elem) | Ty::BinaryHeap(elem) => match field {
                "push" => Ty::Fn {
                    params: vec![*elem.clone()],
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                "pop" | "peek" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Option(elem.clone())),
                    is_async: false,
                },
                "len" | "length" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Int),
                    is_async: false,
                },
                "isEmpty" | "is_empty" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "clear" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::Trie(elem) => match field {
                "insert" => Ty::Fn {
                    params: vec![Ty::String, *elem.clone()],
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                "get" => Ty::Fn {
                    params: vec![Ty::String],
                    ret: Box::new(Ty::Option(elem.clone())),
                    is_async: false,
                },
                "contains" | "starts_with" => Ty::Fn {
                    params: vec![Ty::String],
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "len" | "length" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Int),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::Graph(elem)
            | Ty::DirectedGraph(elem)
            | Ty::UndirectedGraph(elem)
            | Ty::WeightedGraph(elem) => match field {
                "add_node" => Ty::Fn {
                    params: vec![*elem.clone()],
                    ret: Box::new(Ty::Int),
                    is_async: false,
                },
                "add_edge" => Ty::Fn {
                    params: vec![Ty::Int, Ty::Int],
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                "add_weighted_edge" => Ty::Fn {
                    params: vec![Ty::Int, Ty::Int, Ty::Float],
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                "neighbors" | "bfs" | "dfs" => Ty::Fn {
                    params: vec![Ty::Int],
                    ret: Box::new(Ty::Vector(Box::new(Ty::Int))),
                    is_async: false,
                },
                "node_count" | "edge_count" | "len" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Int),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::DisjointSet(elem) => match field {
                "make_set" => Ty::Fn {
                    params: vec![*elem.clone()],
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                "find" => Ty::Fn {
                    params: vec![*elem.clone()],
                    ret: Box::new(Ty::Option(elem.clone())),
                    is_async: false,
                },
                "union" | "connected" => Ty::Fn {
                    params: vec![*elem.clone(), *elem.clone()],
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::BloomFilter(elem) => match field {
                "insert" | "add" => Ty::Fn {
                    params: vec![*elem.clone()],
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                "contains" => Ty::Fn {
                    params: vec![*elem.clone()],
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "clear" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::LRUCache(k, v) | Ty::LFUCache(k, v) => match field {
                "put" | "insert" => Ty::Fn {
                    params: vec![*k.clone(), *v.clone()],
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                "get" => Ty::Fn {
                    params: vec![*k.clone()],
                    ret: Box::new(Ty::Option(v.clone())),
                    is_async: false,
                },
                "contains_key" => Ty::Fn {
                    params: vec![*k.clone()],
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "len" | "length" | "capacity" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Int),
                    is_async: false,
                },
                "clear" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Unit),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::Option(elem) => match field {
                "is_some" | "isSome" | "is_none" | "isNone" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "unwrap" => Ty::Fn {
                    params: Vec::new(),
                    ret: elem.clone(),
                    is_async: false,
                },
                "unwrap_or" => Ty::Fn {
                    params: vec![*elem.clone()],
                    ret: elem.clone(),
                    is_async: false,
                },
                "map" => Ty::Fn {
                    params: vec![Ty::Unknown],
                    ret: Box::new(Ty::Option(Box::new(Ty::Unknown))),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::Result(ok, err) => match field {
                "is_ok" | "isOk" | "is_err" | "isErr" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "unwrap" => Ty::Fn {
                    params: Vec::new(),
                    ret: ok.clone(),
                    is_async: false,
                },
                "unwrap_or" => Ty::Fn {
                    params: vec![*ok.clone()],
                    ret: ok.clone(),
                    is_async: false,
                },
                "unwrap_err" => Ty::Fn {
                    params: Vec::new(),
                    ret: err.clone(),
                    is_async: false,
                },
                "map" => Ty::Fn {
                    params: vec![Ty::Unknown],
                    ret: Box::new(Ty::Result(Box::new(Ty::Unknown), err.clone())),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::Either(l, r) => match field {
                "is_left" | "is_right" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Bool),
                    is_async: false,
                },
                "left" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Option(l.clone())),
                    is_async: false,
                },
                "right" => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Option(r.clone())),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            Ty::MetaType(name, args) => match (name.as_str(), field) {
                ("Vector" | "Array" | "List", "empty" | "new") => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Vector(Box::new(
                        args.first().cloned().unwrap_or(Ty::Unknown),
                    ))),
                    is_async: false,
                },
                ("HashMap" | "Map", "empty" | "new") => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::HashMap(
                        Box::new(args.first().cloned().unwrap_or(Ty::Unknown)),
                        Box::new(args.get(1).cloned().unwrap_or(Ty::Unknown)),
                    )),
                    is_async: false,
                },
                ("Set" | "HashSet", "empty" | "new") => Ty::Fn {
                    params: Vec::new(),
                    ret: Box::new(Ty::Set(Box::new(
                        args.first().cloned().unwrap_or(Ty::Unknown),
                    ))),
                    is_async: false,
                },
                _ => self.emit_unknown_member(recv_ty, field, span),
            },
            _ => self.emit_unknown_member(recv_ty, field, span),
        }
    }

    fn lookup_member_field(
        &mut self,
        owner: &str,
        registry: &HashMap<String, HashMap<String, Ty>>,
        field: &str,
        span: Span,
    ) -> Ty {
        if let Some(fields) = registry.get(owner)
            && let Some(fty) = fields.get(field)
        {
            return fty.clone();
        }
        self.diagnostics.emit(
            Diagnostic::error("E4005", format!("no field `{field}` on `{owner}`"))
                .with_primary_label(span, "unknown field"),
        );
        Ty::Unknown
    }

    fn emit_unknown_member(&mut self, recv_ty: &Ty, field: &str, span: Span) -> Ty {
        self.diagnostics.emit(
            Diagnostic::error(
                "E4005",
                format!("no field or method `{field}` found on `{recv_ty}`"),
            )
            .with_primary_label(span, "unknown member"),
        );
        Ty::Unknown
    }

    fn check_call(
        &mut self,
        callee: &Expr,
        args: &[Expr],
        expected: Option<&Ty>,
        span: Span,
    ) -> Ty {
        if let Expr::TypeConstructor {
            name, type_args, ..
        } = callee
        {
            let lowered: Vec<Ty> = type_args.iter().map(|t| self.lower_type_expr(t)).collect();
            match name.name.as_str() {
                "Vector" => {
                    let elem = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    return Ty::Vector(Box::new(elem));
                }
                "Array" => {
                    let elem = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    return Ty::Array(Box::new(elem));
                }
                "List" => {
                    let elem = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    return Ty::List(Box::new(elem));
                }
                "VecDeque" => {
                    let elem = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    return Ty::VecDeque(Box::new(elem));
                }
                "LinkedList" => {
                    let elem = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    return Ty::LinkedList(Box::new(elem));
                }
                "Stack" => {
                    let elem = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    return Ty::Stack(Box::new(elem));
                }
                "Queue" => {
                    let elem = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    return Ty::Queue(Box::new(elem));
                }
                "CircularBuffer" => {
                    let elem = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    return Ty::CircularBuffer(Box::new(elem));
                }
                "Matrix" => {
                    let elem = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    return Ty::Matrix(Box::new(elem));
                }
                "Tensor" => {
                    let elem = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    return Ty::Tensor(Box::new(elem));
                }
                "Map" => {
                    let k = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    let v = lowered.get(1).cloned().unwrap_or(Ty::Unknown);
                    return Ty::Map(Box::new(k), Box::new(v));
                }
                "HashMap" => {
                    let k = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    let v = lowered.get(1).cloned().unwrap_or(Ty::Unknown);
                    return Ty::HashMap(Box::new(k), Box::new(v));
                }
                "BTreeMap" => {
                    let k = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    let v = lowered.get(1).cloned().unwrap_or(Ty::Unknown);
                    return Ty::BTreeMap(Box::new(k), Box::new(v));
                }
                "OrderedMap" => {
                    let k = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    let v = lowered.get(1).cloned().unwrap_or(Ty::Unknown);
                    return Ty::OrderedMap(Box::new(k), Box::new(v));
                }
                "MultiMap" => {
                    let k = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    let v = lowered.get(1).cloned().unwrap_or(Ty::Unknown);
                    return Ty::MultiMap(Box::new(k), Box::new(v));
                }
                "BiMap" => {
                    let k = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    let v = lowered.get(1).cloned().unwrap_or(Ty::Unknown);
                    return Ty::BiMap(Box::new(k), Box::new(v));
                }
                "Set" => {
                    let elem = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    return Ty::Set(Box::new(elem));
                }
                "HashSet" => {
                    let elem = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    return Ty::HashSet(Box::new(elem));
                }
                "BTreeSet" => {
                    let elem = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    return Ty::BTreeSet(Box::new(elem));
                }
                "OrderedSet" => {
                    let elem = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    return Ty::OrderedSet(Box::new(elem));
                }
                "BitSet" => return Ty::BitSet,
                "MultiSet" => {
                    let elem = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    return Ty::MultiSet(Box::new(elem));
                }
                "PriorityQueue" | "BinaryHeap" => {
                    let elem = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    return Ty::PriorityQueue(Box::new(elem));
                }
                "Trie" => {
                    let elem = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    return Ty::Trie(Box::new(elem));
                }
                "Graph" | "DirectedGraph" => {
                    let elem = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    return Ty::Graph(Box::new(elem));
                }
                "BloomFilter" => {
                    let elem = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    return Ty::BloomFilter(Box::new(elem));
                }
                "LRUCache" | "LruCache" => {
                    let k = lowered.first().cloned().unwrap_or(Ty::Unknown);
                    let v = lowered.get(1).cloned().unwrap_or(Ty::Unknown);
                    return Ty::LRUCache(Box::new(k), Box::new(v));
                }
                _ => return Ty::Unknown,
            }
        }

        if let Expr::Ident(id) = callee {
            match id.name.as_str() {
                "Vector" => {
                    return match expected {
                        Some(Ty::Vector(e)) => Ty::Vector(e.clone()),
                        _ => Ty::Vector(Box::new(Ty::Unknown)),
                    };
                }
                "Array" => {
                    return match expected {
                        Some(Ty::Array(e)) => Ty::Array(e.clone()),
                        _ => Ty::Array(Box::new(Ty::Unknown)),
                    };
                }
                "HashMap" | "Map" => {
                    return match expected {
                        Some(Ty::HashMap(k, v)) => Ty::HashMap(k.clone(), v.clone()),
                        _ => Ty::HashMap(Box::new(Ty::Unknown), Box::new(Ty::Unknown)),
                    };
                }
                "Set" | "HashSet" => {
                    return match expected {
                        Some(Ty::Set(e) | Ty::HashSet(e)) => Ty::Set(e.clone()),
                        _ => Ty::Set(Box::new(Ty::Unknown)),
                    };
                }
                "BitSet" => return Ty::BitSet,
                "OrderedSet" => {
                    return match expected {
                        Some(Ty::OrderedSet(e)) => Ty::OrderedSet(e.clone()),
                        _ => Ty::OrderedSet(Box::new(Ty::Unknown)),
                    };
                }
                "BTreeSet" => {
                    return match expected {
                        Some(Ty::BTreeSet(e)) => Ty::BTreeSet(e.clone()),
                        _ => Ty::BTreeSet(Box::new(Ty::Unknown)),
                    };
                }
                "MultiSet" => {
                    return match expected {
                        Some(Ty::MultiSet(e)) => Ty::MultiSet(e.clone()),
                        _ => Ty::MultiSet(Box::new(Ty::Unknown)),
                    };
                }
                "DisjointSet" => return Ty::DisjointSet(Box::new(Ty::Unknown)),
                "LRUCache" | "LruCache" => {
                    return Ty::LRUCache(Box::new(Ty::Unknown), Box::new(Ty::Unknown));
                }
                "Stack" => return Ty::Stack(Box::new(Ty::Unknown)),
                "Queue" => return Ty::Queue(Box::new(Ty::Unknown)),
                "PriorityQueue" => return Ty::PriorityQueue(Box::new(Ty::Unknown)),
                "Graph" => return Ty::Graph(Box::new(Ty::Unknown)),
                "Trie" => return Ty::Trie(Box::new(Ty::Unknown)),
                "BloomFilter" => return Ty::BloomFilter(Box::new(Ty::Unknown)),
                "Some" => {
                    if args.len() != 1 {
                        self.emit_arg_count("Some", 1, args.len(), span);
                        return Ty::Option(Box::new(Ty::Unknown));
                    }
                    let inner_exp = match expected {
                        Some(Ty::Option(inner)) => Some(inner.as_ref()),
                        _ => None,
                    };
                    let inner = self.check_expr(&args[0], inner_exp);
                    return Ty::Option(Box::new(inner));
                }
                "Ok" => {
                    if args.len() != 1 {
                        self.emit_arg_count("Ok", 1, args.len(), span);
                        return Ty::Result(Box::new(Ty::Unknown), Box::new(Ty::Unknown));
                    }
                    let (ok_exp, err_ty) = match expected {
                        Some(Ty::Result(ok, err)) => (Some(ok.as_ref()), (**err).clone()),
                        _ => (None, Ty::Unknown),
                    };
                    let ok_ty = self.check_expr(&args[0], ok_exp);
                    return Ty::Result(Box::new(ok_ty), Box::new(err_ty));
                }
                "Err" => {
                    if args.len() != 1 {
                        self.emit_arg_count("Err", 1, args.len(), span);
                        return Ty::Result(Box::new(Ty::Unknown), Box::new(Ty::Unknown));
                    }
                    let (ok_ty, err_exp) = match expected {
                        Some(Ty::Result(ok, err)) => ((**ok).clone(), Some(err.as_ref())),
                        _ => (Ty::Unknown, None),
                    };
                    let err_ty = self.check_expr(&args[0], err_exp);
                    return Ty::Result(Box::new(ok_ty), Box::new(err_ty));
                }
                "print" | "println" => {
                    for a in args {
                        let _ = self.check_expr(a, None);
                    }
                    return Ty::Unit;
                }
                "run" | "App" | "Router" => {
                    for a in args {
                        let _ = self.check_expr(a, None);
                    }
                    return Ty::App;
                }
                "send" => {
                    if args.len() != 1 {
                        self.emit_arg_count("send", 1, args.len(), span);
                    } else {
                        let _ = self.check_expr(&args[0], None);
                    }
                    return Ty::Response;
                }
                "get" | "post" | "put" | "delete" => {
                    if args.len() != 2 && args.len() != 3 {
                        self.emit_arg_count(&id.name, 2, args.len(), span);
                        return Ty::Unit;
                    }
                    let path_ty = self.check_expr(&args[0], Some(&Ty::String));
                    if !self.is_assignable(&Ty::String, &path_ty) {
                        self.emit_type_mismatch(&Ty::String, &path_ty, args[0].span());
                    }
                    let handler_arg = if args.len() == 3 {
                        let _ = self.check_expr(&args[1], None);
                        &args[2]
                    } else {
                        &args[1]
                    };
                    let handler_ty = self.check_expr(handler_arg, None);
                    if !matches!(handler_ty, Ty::Fn { .. } | Ty::Unknown) {
                        self.diagnostics.emit(
                            Diagnostic::error(
                                "E4001",
                                format!(
                                    "route `{}` expects a handler closure or function, found `{handler_ty}`",
                                    id.name
                                ),
                            )
                            .with_primary_label(handler_arg.span(), "expected handler function/closure"),
                        );
                    }
                    return Ty::Unit;
                }
                // Direct class constructor call: `UserService(db)`
                cls_name if self.classes.contains_key(cls_name) => {
                    let init_params = self.classes[cls_name].init_params.clone();
                    if args.len() != init_params.len() {
                        self.emit_arg_count(cls_name, init_params.len(), args.len(), span);
                    }
                    for (arg, (_, exp_ty)) in args.iter().zip(init_params.iter()) {
                        let actual = self.check_expr(arg, Some(exp_ty));
                        if !self.is_assignable(exp_ty, &actual) {
                            self.emit_type_mismatch(exp_ty, &actual, arg.span());
                        }
                    }
                    return Ty::Class(cls_name.to_string());
                }
                _ => {}
            }
        }

        if let Expr::FieldAccess {
            receiver, field, ..
        } = callee
        {
            let recv_ty = self.check_expr(receiver, None);
            if recv_ty == Ty::App {
                match field.name.as_str() {
                    "use" => {
                        for a in args {
                            let _ = self.check_expr(a, None);
                        }
                        return Ty::App;
                    }
                    "get" | "post" | "put" | "delete" | "patch" => {
                        for a in args {
                            let _ = self.check_expr(a, None);
                        }
                        return Ty::App;
                    }
                    "listen" => {
                        for a in args {
                            let _ = self.check_expr(a, None);
                        }
                        return Ty::Unit;
                    }
                    _ => {}
                }
            } else if recv_ty == Ty::MetaResponse {
                for a in args {
                    let _ = self.check_expr(a, None);
                }
                return Ty::Response;
            }
        }

        let callee_ty = self.check_expr(callee, None);
        match callee_ty {
            Ty::Fn { params, ret, .. } => {
                if args.len() != params.len() {
                    self.emit_arg_count("function", params.len(), args.len(), span);
                }
                for (arg, exp_ty) in args.iter().zip(params.iter()) {
                    let actual = self.check_expr(arg, Some(exp_ty));
                    if !self.is_assignable(exp_ty, &actual) {
                        self.emit_type_mismatch(exp_ty, &actual, arg.span());
                    }
                }
                *ret
            }
            Ty::Unknown => {
                for a in args {
                    let _ = self.check_expr(a, None);
                }
                Ty::Unknown
            }
            other => {
                self.diagnostics.emit(
                    Diagnostic::error(
                        "E4007",
                        format!("expression of type `{other}` is not callable"),
                    )
                    .with_primary_label(callee.span(), "not a function or method"),
                );
                Ty::Unknown
            }
        }
    }

    fn check_closure(
        &mut self,
        params: &[ClosureParam],
        return_ty: Option<&TypeExpr>,
        body: &ClosureBody,
        expected: Option<&Ty>,
        span: Span,
    ) -> Ty {
        let expected_fn = match expected {
            Some(Ty::Fn { params, ret, .. }) => Some((params.clone(), (**ret).clone())),
            _ => None,
        };

        let mut param_tys = Vec::with_capacity(params.len());
        self.push_scope();
        for (idx, p) in params.iter().enumerate() {
            let pty = if let Some(ann) = &p.ty {
                self.lower_type_expr(ann)
            } else if let Some((exp_params, _)) = &expected_fn
                && let Some(et) = exp_params.get(idx)
            {
                et.clone()
            } else if p.name.name == "request" || p.name.name == "req" {
                Ty::Request
            } else {
                self.diagnostics.emit(
                    Diagnostic::error(
                        "E4002",
                        format!(
                            "cannot infer type of closure parameter `{}`; add a type annotation",
                            p.name.name
                        ),
                    )
                    .with_primary_label(p.span, "explicit parameter type required here"),
                );
                Ty::Unknown
            };
            self.define_local(p.name.name.clone(), pty.clone());
            param_tys.push(pty);
        }

        let explicit_ret = return_ty
            .map(|rt| self.lower_type_expr(rt))
            .or_else(|| expected_fn.map(|(_, r)| r));

        let prev_ret = self.current_return_ty.clone();
        let inferred_ret = match body {
            ClosureBody::Expr(expr) => {
                let r = self.check_expr(expr, explicit_ret.as_ref());
                if let Some(exp) = &explicit_ret
                    && !self.is_assignable(exp, &r)
                {
                    self.emit_type_mismatch(exp, &r, expr.span());
                }
                explicit_ret.unwrap_or(r)
            }
            ClosureBody::Block(blk) => {
                let inferred = explicit_ret
                    .clone()
                    .unwrap_or_else(|| infer_block_return_hint(blk));
                self.current_return_ty = if inferred == Ty::Unknown {
                    None
                } else {
                    Some(inferred.clone())
                };
                let inferred_from_returns = self.check_closure_block(blk, explicit_ret.as_ref());
                if let Some(exp) = &explicit_ret
                    && *exp != Ty::Unit
                    && !exp.contains_unknown()
                    && !block_always_returns(blk)
                {
                    self.diagnostics.emit(
                        Diagnostic::error(
                            "E4011",
                            format!("closure must return `{exp}` on all paths"),
                        )
                        .with_primary_label(span, "missing return value"),
                    );
                }
                explicit_ret.unwrap_or(inferred_from_returns)
            }
        };
        self.current_return_ty = prev_ret;
        self.pop_scope();

        Ty::Fn {
            params: param_tys,
            ret: Box::new(inferred_ret),
            is_async: false,
        }
    }

    fn check_closure_block(&mut self, blk: &Block, explicit_ret: Option<&Ty>) -> Ty {
        let mut found_return: Option<Ty> = None;
        for stmt in &blk.stmts {
            if let Stmt::Return { value, span } = stmt {
                let rty = match value {
                    Some(v) => self.check_expr(v, explicit_ret.or(found_return.as_ref())),
                    None => Ty::Unit,
                };
                if let Some(exp) = explicit_ret {
                    if !self.is_assignable(exp, &rty) {
                        self.emit_type_mismatch(exp, &rty, *span);
                    }
                } else if let Some(prev) = &found_return
                    && !self.is_assignable(prev, &rty)
                    && !self.is_assignable(&rty, prev)
                {
                    self.emit_type_mismatch(prev, &rty, *span);
                }
                if found_return.is_none() {
                    found_return = Some(rty);
                }
            } else {
                self.check_stmt(stmt);
            }
        }
        if let Some(rty) = found_return {
            rty
        } else if let Some(Stmt::Expr { expr, .. }) = blk.stmts.last() {
            self.check_expr(expr, explicit_ret)
        } else {
            Ty::Unit
        }
    }

    fn check_match(
        &mut self,
        scrutinee: &Expr,
        arms: &[MatchArm],
        expected: Option<&Ty>,
        span: Span,
    ) -> Ty {
        let scrut_ty = self.check_expr(scrutinee, None);
        let mut arm_ty: Option<Ty> = expected.cloned();
        let mut has_wildcard = false;
        let mut covered_variants = HashSet::new();

        for arm in arms {
            self.push_scope();
            self.check_pattern(
                &arm.pattern,
                &scrut_ty,
                &mut has_wildcard,
                &mut covered_variants,
            );
            let body_ty = match &arm.body {
                ClosureBody::Expr(e) => self.check_expr(e, arm_ty.as_ref()),
                ClosureBody::Block(blk) => self.check_closure_block(blk, arm_ty.as_ref()),
            };
            self.pop_scope();

            if let Some(first) = &arm_ty {
                if !self.is_assignable(first, &body_ty) {
                    if self.is_assignable(&body_ty, first) {
                        arm_ty = Some(body_ty);
                    } else {
                        self.emit_type_mismatch(first, &body_ty, arm.span);
                    }
                }
            } else {
                arm_ty = Some(body_ty);
            }
        }

        // Exhaustiveness verification
        if !has_wildcard {
            match &scrut_ty {
                Ty::Enum(en) => {
                    if let Some(variants) = self.enums.get(en) {
                        let missing: Vec<&str> = variants
                            .iter()
                            .map(|(vn, _)| vn.as_str())
                            .filter(|vn| !covered_variants.contains(*vn))
                            .collect();
                        if !missing.is_empty() {
                            self.diagnostics.emit(
                                Diagnostic::error(
                                    "E4010",
                                    format!(
                                        "non-exhaustive `match` on `{en}`: missing variant(s): {}",
                                        missing.join(", ")
                                    ),
                                )
                                .with_primary_label(span, "patterns do not cover all enum variants")
                                .with_help(
                                    "add arms for missing variants or a `_ => ...` wildcard arm",
                                ),
                            );
                        }
                    }
                }
                Ty::Option(_) => {
                    if !covered_variants.contains("Some") || !covered_variants.contains("None") {
                        self.diagnostics.emit(
                            Diagnostic::error(
                                "E4010",
                                "non-exhaustive `match` on `Option`: must cover both `Some(...)` and `None`",
                            )
                            .with_primary_label(span, "missing `Some` or `None` arm"),
                        );
                    }
                }
                Ty::Result(_, _) => {
                    if !covered_variants.contains("Ok") || !covered_variants.contains("Err") {
                        self.diagnostics.emit(
                            Diagnostic::error(
                                "E4010",
                                "non-exhaustive `match` on `Result`: must cover both `Ok(...)` and `Err(...)`",
                            )
                            .with_primary_label(span, "missing `Ok` or `Err` arm"),
                        );
                    }
                }
                Ty::Bool => {
                    if !covered_variants.contains("true") || !covered_variants.contains("false") {
                        self.diagnostics.emit(
                            Diagnostic::error(
                                "E4010",
                                "non-exhaustive `match` on `Bool`: must cover both `true` and `false`",
                            )
                            .with_primary_label(span, "non-exhaustive boolean match"),
                        );
                    }
                }
                Ty::Unknown => {}
                _ => {
                    self.diagnostics.emit(
                        Diagnostic::error(
                            "E4010",
                            format!(
                                "non-exhaustive `match` on `{scrut_ty}`: add a `_` catch-all arm"
                            ),
                        )
                        .with_primary_label(span, "missing `_` wildcard arm"),
                    );
                }
            }
        }

        arm_ty.unwrap_or(Ty::Unit)
    }

    fn check_pattern(
        &mut self,
        pattern: &Pattern,
        scrut_ty: &Ty,
        has_wildcard: &mut bool,
        covered: &mut HashSet<String>,
    ) {
        match pattern {
            Pattern::Wildcard(_) => {
                *has_wildcard = true;
            }
            Pattern::IntLit(_, sp) => {
                if !self.is_assignable(&Ty::Int, scrut_ty) {
                    self.emit_type_mismatch(scrut_ty, &Ty::Int, *sp);
                }
            }
            Pattern::FloatLit(_, sp) => {
                if !self.is_assignable(&Ty::Float, scrut_ty) {
                    self.emit_type_mismatch(scrut_ty, &Ty::Float, *sp);
                }
            }
            Pattern::StringLit(_, sp) => {
                if !self.is_assignable(&Ty::String, scrut_ty) {
                    self.emit_type_mismatch(scrut_ty, &Ty::String, *sp);
                }
            }
            Pattern::CharLit(_, sp) => {
                if !self.is_assignable(&Ty::Char, scrut_ty) {
                    self.emit_type_mismatch(scrut_ty, &Ty::Char, *sp);
                }
            }
            Pattern::BoolLit(b, sp) => {
                if !self.is_assignable(&Ty::Bool, scrut_ty) {
                    self.emit_type_mismatch(scrut_ty, &Ty::Bool, *sp);
                }
                covered.insert(b.to_string());
            }
            Pattern::Null(sp) => {
                if !matches!(scrut_ty, Ty::Option(_) | Ty::Unknown) {
                    self.diagnostics.emit(
                        Diagnostic::error(
                            "E4001",
                            format!("pattern `null` cannot match `{scrut_ty}`"),
                        )
                        .with_primary_label(*sp, "expected `Option<T>` scrutinee"),
                    );
                }
                covered.insert("None".to_string());
                covered.insert("null".to_string());
            }
            Pattern::Binding(id) => {
                if id.name == "None" {
                    if !matches!(scrut_ty, Ty::Option(_) | Ty::Unknown) {
                        self.diagnostics.emit(
                            Diagnostic::error(
                                "E4001",
                                format!("pattern `None` cannot match `{scrut_ty}`"),
                            )
                            .with_primary_label(id.span, "expected `Option<T>` scrutinee"),
                        );
                    }
                    covered.insert("None".to_string());
                    return;
                }
                if let Ty::Enum(en) = scrut_ty
                    && let Some(variants) = self.enums.get(en)
                    && let Some((_, payload)) = variants.iter().find(|(vn, _)| vn == &id.name)
                {
                    if !payload.is_empty() {
                        self.diagnostics.emit(
                            Diagnostic::error(
                                "E4001",
                                format!("enum variant `{en}.{}` carries payload values", id.name),
                            )
                            .with_primary_label(id.span, "missing `(...)` payload bindings"),
                        );
                    }
                    covered.insert(id.name.clone());
                    return;
                }
                *has_wildcard = true;
                self.define_local(id.name.clone(), scrut_ty.clone());
            }
            Pattern::Variant {
                enum_name,
                variant,
                bindings,
                span,
            } => match scrut_ty {
                Ty::Option(inner) if enum_name.is_none() && variant.name == "Some" => {
                    covered.insert("Some".to_string());
                    if bindings.len() != 1 {
                        self.emit_arg_count("Some", 1, bindings.len(), *span);
                    } else if bindings[0].name != "_" {
                        self.define_local(bindings[0].name.clone(), (**inner).clone());
                    }
                }
                Ty::Result(ok_ty, err_ty)
                    if enum_name.is_none() && (variant.name == "Ok" || variant.name == "Err") =>
                {
                    covered.insert(variant.name.clone());
                    let payload_ty = if variant.name == "Ok" { ok_ty } else { err_ty };
                    if bindings.len() != 1 {
                        self.emit_arg_count(&variant.name, 1, bindings.len(), *span);
                    } else if bindings[0].name != "_" {
                        self.define_local(bindings[0].name.clone(), (**payload_ty).clone());
                    }
                }
                Ty::Enum(en) => {
                    if let Some(prefix) = enum_name
                        && prefix.name != *en
                    {
                        self.diagnostics.emit(
                            Diagnostic::error(
                                "E4001",
                                format!(
                                    "mismatched enum in pattern: expected `{en}`, found `{}`",
                                    prefix.name
                                ),
                            )
                            .with_primary_label(prefix.span, "wrong enum type"),
                        );
                        return;
                    }
                    let Some(variants) = self.enums.get(en).cloned() else {
                        return;
                    };
                    let Some((_, payload_tys)) =
                        variants.iter().find(|(vn, _)| vn == &variant.name)
                    else {
                        self.diagnostics.emit(
                            Diagnostic::error(
                                "E4005",
                                format!("unknown variant `{}` on enum `{en}`", variant.name),
                            )
                            .with_primary_label(variant.span, "variant does not exist"),
                        );
                        return;
                    };
                    covered.insert(variant.name.clone());
                    if bindings.len() != payload_tys.len() {
                        self.emit_arg_count(
                            &variant.name,
                            payload_tys.len(),
                            bindings.len(),
                            *span,
                        );
                    }
                    for (b, pty) in bindings.iter().zip(payload_tys.iter()) {
                        if b.name != "_" {
                            self.define_local(b.name.clone(), pty.clone());
                        }
                    }
                }
                Ty::Unknown => {
                    for b in bindings {
                        if b.name != "_" {
                            self.define_local(b.name.clone(), Ty::Unknown);
                        }
                    }
                }
                other => {
                    self.diagnostics.emit(
                        Diagnostic::error(
                            "E4001",
                            format!(
                                "variant pattern `{}` cannot match value of type `{other}`",
                                variant.name
                            ),
                        )
                        .with_primary_label(*span, "mismatched pattern type"),
                    );
                }
            },
        }
    }

    fn is_assignable(&self, expected: &Ty, actual: &Ty) -> bool {
        if expected == actual || *expected == Ty::Unknown || *actual == Ty::Unknown {
            return true;
        }
        match (expected, actual) {
            // Numeric subtyping
            (
                Ty::Int,
                Ty::Int8
                | Ty::Int16
                | Ty::Int32
                | Ty::Int64
                | Ty::UInt
                | Ty::UInt8
                | Ty::UInt16
                | Ty::UInt32
                | Ty::UInt64,
            ) => true,
            (Ty::Float, Ty::Float32 | Ty::Float64 | Ty::Decimal) => true,

            // Sequential collections
            (Ty::Array(e), Ty::Array(a))
            | (Ty::Vector(e), Ty::Vector(a))
            | (Ty::List(e), Ty::List(a))
            | (Ty::Array(e), Ty::Vector(a))
            | (Ty::Vector(e), Ty::Array(a))
            | (Ty::Array(e), Ty::List(a))
            | (Ty::List(e), Ty::Array(a))
            | (Ty::Vector(e), Ty::List(a))
            | (Ty::List(e), Ty::Vector(a))
            | (Ty::VecDeque(e), Ty::VecDeque(a))
            | (Ty::LinkedList(e), Ty::LinkedList(a))
            | (Ty::Stack(e), Ty::Stack(a))
            | (Ty::Queue(e), Ty::Queue(a))
            | (Ty::CircularBuffer(e), Ty::CircularBuffer(a))
            | (Ty::Matrix(e), Ty::Matrix(a))
            | (Ty::Tensor(e), Ty::Tensor(a)) => self.is_assignable(e, a),

            // Associative collections
            (Ty::Map(ek, ev), Ty::Map(ak, av))
            | (Ty::HashMap(ek, ev), Ty::HashMap(ak, av))
            | (Ty::Map(ek, ev), Ty::HashMap(ak, av))
            | (Ty::HashMap(ek, ev), Ty::Map(ak, av))
            | (Ty::BTreeMap(ek, ev), Ty::BTreeMap(ak, av))
            | (Ty::OrderedMap(ek, ev), Ty::OrderedMap(ak, av))
            | (Ty::MultiMap(ek, ev), Ty::MultiMap(ak, av))
            | (Ty::BiMap(ek, ev), Ty::BiMap(ak, av))
            | (Ty::LRUCache(ek, ev), Ty::LRUCache(ak, av))
            | (Ty::LFUCache(ek, ev), Ty::LFUCache(ak, av)) => {
                self.is_assignable(ek, ak) && self.is_assignable(ev, av)
            }

            // Sets
            (Ty::Set(e), Ty::Set(a))
            | (Ty::HashSet(e), Ty::HashSet(a))
            | (Ty::Set(e), Ty::HashSet(a))
            | (Ty::HashSet(e), Ty::Set(a))
            | (Ty::BTreeSet(e), Ty::BTreeSet(a))
            | (Ty::OrderedSet(e), Ty::OrderedSet(a))
            | (Ty::MultiSet(e), Ty::MultiSet(a)) => self.is_assignable(e, a),

            // Specialized
            (Ty::PriorityQueue(e), Ty::PriorityQueue(a))
            | (Ty::BinaryHeap(e), Ty::BinaryHeap(a))
            | (Ty::Trie(e), Ty::Trie(a))
            | (Ty::Graph(e), Ty::Graph(a))
            | (Ty::DirectedGraph(e), Ty::DirectedGraph(a))
            | (Ty::UndirectedGraph(e), Ty::UndirectedGraph(a))
            | (Ty::WeightedGraph(e), Ty::WeightedGraph(a))
            | (Ty::DisjointSet(e), Ty::DisjointSet(a))
            | (Ty::BloomFilter(e), Ty::BloomFilter(a))
            | (Ty::RingBuffer(e), Ty::RingBuffer(a)) => self.is_assignable(e, a),

            // Option, Result, Either, Tuple
            (Ty::Option(e), Ty::Option(a)) => self.is_assignable(e, a),
            (Ty::Result(eo, ee), Ty::Result(ao, ae)) => {
                self.is_assignable(eo, ao) && self.is_assignable(ee, ae)
            }
            (Ty::Either(el, er), Ty::Either(al, ar)) => {
                self.is_assignable(el, al) && self.is_assignable(er, ar)
            }
            (Ty::Tuple(et), Ty::Tuple(at)) => {
                et.len() == at.len()
                    && et
                        .iter()
                        .zip(at.iter())
                        .all(|(e, a)| self.is_assignable(e, a))
            }

            (Ty::Interface(iface), Ty::Class(cls)) => self
                .classes
                .get(cls)
                .is_some_and(|c| c.implements.iter().any(|imp| imp == iface)),
            (
                Ty::Fn {
                    params: ep,
                    ret: er,
                    ..
                },
                Ty::Fn {
                    params: ap,
                    ret: ar,
                    ..
                },
            ) => {
                ep.len() == ap.len()
                    && ep
                        .iter()
                        .zip(ap.iter())
                        .all(|(e, a)| self.is_assignable(e, a))
                    && self.is_assignable(er, ar)
            }
            _ => false,
        }
    }

    fn emit_type_mismatch(&mut self, expected: &Ty, actual: &Ty, span: Span) {
        self.diagnostics.emit(
            Diagnostic::error(
                "E4001",
                format!("type mismatch: expected `{expected}`, found `{actual}`"),
            )
            .with_primary_label(span, format!("expected `{expected}`, found `{actual}`")),
        );
    }

    fn emit_arg_count(&mut self, name: &str, expected: usize, actual: usize, span: Span) {
        self.diagnostics.emit(
            Diagnostic::error(
                "E4007",
                format!("`{name}` expects {expected} argument(s), but {actual} were supplied"),
            )
            .with_primary_label(span, "incorrect number of arguments"),
        );
    }

    fn push_scope(&mut self) {
        self.scopes.push(HashMap::new());
    }

    fn pop_scope(&mut self) {
        let _ = self.scopes.pop();
    }

    fn define_local(&mut self, name: String, ty: Ty) {
        if let Some(top) = self.scopes.last_mut() {
            top.insert(name, ty);
        }
    }

    fn lookup_local(&self, name: &str) -> Option<&Ty> {
        for scope in self.scopes.iter().rev() {
            if let Some(t) = scope.get(name) {
                return Some(t);
            }
        }
        None
    }
}

fn infer_block_return_hint(blk: &Block) -> Ty {
    for stmt in &blk.stmts {
        if let Stmt::Return { value: None, .. } = stmt {
            return Ty::Unit;
        }
    }
    Ty::Unknown
}

fn block_always_returns(blk: &Block) -> bool {
    blk.stmts.iter().any(stmt_always_returns)
}

fn stmt_always_returns(stmt: &Stmt) -> bool {
    match stmt {
        Stmt::Return { .. } => true,
        Stmt::If {
            then_branch,
            else_branch: Some(eb),
            ..
        } => {
            let else_returns = match eb {
                ElseBranch::Block(b) => block_always_returns(b),
                ElseBranch::If(nested) => stmt_always_returns(nested),
            };
            block_always_returns(then_branch) && else_returns
        }
        Stmt::TryCatch {
            try_block,
            catch_block,
            ..
        } => block_always_returns(try_block) && block_always_returns(catch_block),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use kora_hir::lower_and_resolve;
    use kora_parser::parse_module;
    use kora_span::FileId;

    use super::*;

    fn run_check(src: &str) -> (DiagnosticBag, TypeCheckOutput) {
        let mut bag = DiagnosticBag::new();
        let ast = parse_module(FileId(0), src, &mut bag);
        let hir = lower_and_resolve(ast, &mut bag);
        let out = check_module(&hir, &mut bag);
        (bag, out)
    }

    #[test]
    fn infers_types_and_verifies_interface_conformance() {
        let src = r#"
model User {
    id: Int
    name: String
    active: Bool
}

interface UserRepo {
    fn find(id: Int) -> Option<User>
}

class SqlUserRepo implements UserRepo {
    db: Database

    init(db: Database) {
        this.db = db
    }

    fn find(id: Int) -> Option<User> {
        if id <= 0 {
            return None
        }
        return Some(User { id: id, name: "Ahmet", active: true })
    }
}

fn loadRepo(db: Database) -> UserRepo {
    let concrete = SqlUserRepo(db)
    let repo: UserRepo = concrete
    return repo
}
"#;
        let (bag, out) = run_check(src);
        assert!(
            !bag.has_errors(),
            "unexpected type errors: {:?}",
            bag.items()
        );
        assert!(out.classes.contains_key("SqlUserRepo"));
        assert!(out.functions.contains_key("loadRepo"));
    }

    #[test]
    fn catches_missing_interface_method_and_non_exhaustive_match() {
        let src = r#"
enum Role {
    Admin
    Member
    Guest
}

interface Greeter {
    fn greet(name: String) -> String
}

class BrokenGreeter implements Greeter {
}

fn roleLabel(r: Role) -> String {
    return match r {
        Role.Admin => "admin",
        Role.Member => "member",
    }
}
"#;
        let (bag, _) = run_check(src);
        assert!(bag.items().iter().any(|d| d.code == "E4008"));
        assert!(bag.items().iter().any(|d| d.code == "E4010"));
    }
}
