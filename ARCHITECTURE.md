# System Architecture

This document describes the high-level data flow and isolation architecture of the AI Revenue Recovery Agent.

## Flow Diagram

`mermaid
graph TD
    %% Entities
    Customer(Customer)
    EcomApp[E-commerce React App]
    EcomBackend[Express Backend]
    Razorpay(Razorpay Gateway)
    DB[(MongoDB)]
    
    %% AI Pipeline
    RecoveryBackend[Recovery Backend]
    ContextEngine[Customer + Payment Context]
    AI[AI Decision Engine]
    Policy[Policy/Safety Layer]
    ToolExecutor[Tool Executor]
    Queue[(BullMQ + Redis)]
    Worker[Recovery Worker]
    
    %% Actions
    ActionReminder[Reminder / Payment Link / Retry / Escalation]
    StatusCheck[Payment Status Check]
    EndState((Recovered / Escalated / Stopped))
    Dashboard[Dashboard Metrics]

    %% Connections - E-Commerce Flow
    Customer -->|Checks out| EcomApp
    EcomApp -->|Initiates Payment| EcomBackend
    EcomBackend -->|Creates Order| Razorpay
    Razorpay -.->|Fails| EcomBackend
    EcomBackend -->|Saves state| DB

    %% Connections - Recovery Flow
    DB -->|Failed Payment Detection| RecoveryBackend
    RecoveryBackend --> ContextEngine
    ContextEngine -->|JSON Context| AI
    AI -->|Proposed Strategy| Policy
    
    %% Safety Boundary Note
    Policy -.->|Validates constraints & limits| ToolExecutor
    
    ToolExecutor -->|Schedules Action| Queue
    Queue -->|Pulls Job| Worker
    Worker --> ActionReminder
    
    ActionReminder -->|Schedules Follow-up| Queue
    Worker --> StatusCheck
    StatusCheck -->|Queries| DB
    StatusCheck -->|If Successful/Max Limits| EndState
    
    EndState --> Dashboard
    
    %% Styles
    classDef safe fill:#d4edda,stroke:#28a745,stroke-width:2px;
    classDef ai fill:#cce5ff,stroke:#007bff,stroke-width:2px;
    classDef db fill:#f8d7da,stroke:#dc3545,stroke-width:2px;
    
    class Policy,ToolExecutor safe;
    class AI ai;
    class DB,Queue db;
`

## Security & Isolation Boundaries

1. **AI Isolated from Database:** The AI does **NOT** directly query MongoDB. A dedicated Context Engine formats data into JSON strings and passes it to the AI.
2. **AI Isolated from Execution:** The AI cannot execute arbitrary code. It only outputs a JSON string containing a decision enum.
3. **Deterministic Verification:** The output of the AI is fed directly into a deterministic Node.js Policy/Safety Layer which overrides the AI if it attempts to exceed attempt limits or ignores recent success webhooks.
4. **Secrets Management:** The AI does **NOT** have access to Razorpay credentials or Redis configuration. The Backend Tool Executor manages the integration.
