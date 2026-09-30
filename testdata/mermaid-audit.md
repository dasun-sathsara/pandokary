---
title: Mermaid viewer audit
---

## Flowchart

```mermaid
flowchart LR
    subgraph Input[Source documents]
        A[Markdown notes] --> B{Valid source?}
    end
    B -->|Yes| C[Render portable HTML]
    B -->|No| D[Show source and error]
    C --> E[Read and navigate]
    C --> F[Print and share]
    classDef sourceStyle fill:#fff0c0,stroke:#503000,color:#301800
    class A sourceStyle
```

## Sequence

```mermaid
sequenceDiagram
    participant Reader
    participant Document
    Reader->>Document: Open appearance
    Note over Reader,Document: Preferences stay in this browser
    Document-->>Reader: Show available themes
    Reader->>Document: Choose a theme
    Document-->>Reader: Update diagrams without losing the view
```

## Class

```mermaid
classDiagram
    Document "1" --> "*" Diagram
    class Document {
        +String title
        +render()
    }
    class Diagram {
        +String source
        +fit()
    }
```

## State

```mermaid
stateDiagram-v2
    [*] --> Reading
    Reading --> Expanded: Open diagram
    Expanded --> Reading: Escape
    Reading --> [*]
```

## Entity relationship

```mermaid
erDiagram
    DOCUMENT ||--o{ DIAGRAM : contains
    DOCUMENT {
        string title
    }
    DIAGRAM {
        string source
    }
```

## Gantt

```mermaid
gantt
    title Reader maintenance
    dateFormat YYYY-MM-DD
    section Repair
    Reproduce :a, 2026-09-28, 1d
    Fix :after a, 2d
```

## Pie

```mermaid
pie title Documents
    "Notes" : 60
    "Diagrams" : 40
```

## Mindmap

```mermaid
mindmap
    root((Reader))
        Documents
        Diagrams
            Pan
            Zoom
        Export
```

## Timeline

```mermaid
timeline
    title Reader workflow
    Source : Markdown
    Export : Portable HTML
    Read : Navigate : Inspect diagrams
```

## Git graph

```mermaid
gitGraph
    commit
    branch repair
    checkout repair
    commit
    checkout main
    merge repair
```

## Invalid source

The final block deliberately fails. Other diagrams and reader controls must remain usable.

```mermaid
flowchart LR
    A[Unclosed label
```
