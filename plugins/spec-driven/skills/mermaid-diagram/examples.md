# Mermaid Diagram Examples

Ready-to-use templates on a neutral sample application: an invoicing product
with **the web app** (browser client), **the API** (HTTP backend), **the
worker** (background jobs), a **database** and an external **payment
provider**. In your project, take participant names from the spec's
*System names* and the existing contracts from the code.

In a spec, diagrams show **observable contracts between modules** — calls,
payloads, statuses and failure paths — never internal functions, classes or
libraries.

---

## 1. Flowchart — Invoice Submission Flow

```mermaid
flowchart TD
    A((User)) --> B[Fill invoice form]
    B --> C{Valid input?}
    C -->|No| D[Show inline errors]
    D --> B
    C -->|Yes| E[Submit invoice]
    E --> F{Attachment within size limit?}
    F -->|No| G[Reject: 413]
    G --> B
    F -->|Yes| H[Store invoice as draft]
    H --> I[Show invoice page]
```

---

## 2. Sequence Diagram — Sending an Invoice (module interactions)

The shape a spec's *Module interactions* section uses: one participant per
system name, existing or new contracts on the arrows, every failure path shown.

```mermaid
sequenceDiagram
    actor U as User
    participant W as web app
    participant A as API
    participant Q as worker
    participant P as payment provider

    U->>W: Click "Send invoice"
    W->>A: POST /invoices/{id}/send (existing)
    activate A
    alt Invoice is draft
        A-->>W: 202 { status: "sending" }
        A->>Q: enqueue send job
        Q->>P: create payment link
        alt Provider answers within 10 s
            P-->>Q: 200 { link }
            Q->>A: mark invoice sent
        else Timeout or 5xx
            Q->>A: mark send failed (retry later)
        end
    else Invoice is not draft
        A-->>W: 409 { error: "INVOICE_NOT_DRAFT" }
    end
    deactivate A
```

---

## 3. Sequence Diagram — Request Pipeline with Failure Paths

```mermaid
sequenceDiagram
    participant W as web app
    participant A as API
    participant D as database

    W->>A: GET /invoices?status=sent
    alt Not signed in
        A-->>W: 401 Unauthorized
    else Rate limit exceeded
        A-->>W: 429 Too Many Requests
    else Invalid filter value
        A-->>W: 400 { errors: [...] }
    else Valid request
        A->>D: read invoices of the organisation
        D-->>A: rows
        A-->>W: 200 { items, nextCursor }
    end
```

---

## 4. ER Diagram — Invoicing Data

```mermaid
erDiagram
    ORGANISATION {
        id id PK
        string name
    }

    INVOICE {
        id id PK
        id organisation FK
        string number UK "unique per organisation"
        string status "draft | sent | paid | void"
        date dueDate
    }

    LINE_ITEM {
        id id PK
        id invoice FK
        string description
        decimal amount
    }

    ORGANISATION ||--o{ INVOICE : "issues"
    INVOICE ||--o{ LINE_ITEM : "contains"
```

---

## 5. State Diagram — Invoice Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft: User creates invoice
    Draft --> Sent: User sends
    Sent --> Paid: Payment confirmed
    Sent --> Void: User voids
    Draft --> Void: User voids
    Paid --> [*]
    Void --> [*]

    state Sent {
        [*] --> AwaitingPayment
        AwaitingPayment --> Overdue: Due date passed
        Overdue --> AwaitingPayment: Due date extended
    }
```

---

## 6. Flowchart — Upload Validation Pipeline

```mermaid
flowchart LR
    A[Client sends file] --> B{Allowed file type?}
    B -->|No| C[Reject: 400]
    B -->|Yes| D{Size check}
    D -->|> 10 MB| E[Reject: 413]
    D -->|≤ 10 MB| F[Store under server-generated name]
    F --> G[Link file to invoice]
    G --> H[Return success]

    style C fill:#ff6b6b,color:#fff
    style E fill:#ff6b6b,color:#fff
    style H fill:#51cf66,color:#fff
```

---

## 7. Class Diagram — Domain Model

```mermaid
classDiagram
    class Invoice {
        +id
        +number
        +status
        +dueDate
        +total() Amount
    }

    class LineItem {
        +id
        +description
        +amount
    }

    class Reminder {
        +id
        +sentAt
    }

    Invoice "1" *-- "*" LineItem : contains
    Invoice "1" --> "*" Reminder : triggers
```

---

## 8. Gantt Chart — Rollout Timeline

```mermaid
gantt
    dateFormat YYYY-MM-DD
    title Invoice Reminders Rollout

    section Spec
        Spec review        :done, review, 2024-01-01, 2d
        Spec approved      :milestone, approved, after review, 0d

    section Delivery
        API changes        :api, after approved, 3d
        Worker job         :worker, after api, 2d
        Web app screens    :web, after api, 3d

    section Release
        Feature flag on for one organisation :pilot, after web, 2d
        General availability                 :ga, after pilot, 1d
```

---

## 9. Mindmap — Feature Breakdown

```mermaid
mindmap
  root((Invoicing))
    Web app
      Invoice list
      Invoice form
      Status filters
    API
      Invoices
      Line items
      Attachments
    Worker
      Reminders
      Exports
    External
      Payment provider
      Email delivery
```
