Text-to-SQL with Clarification Engine — Complete Project Blueprint
We're going to build a production-oriented GenAI application that lets users connect their own SQL databases, ask questions in natural English, and receive accurate query results as tables, charts, and explanations.
The project will go beyond basic Text-to-SQL by supporting multiple database engines, clarifying ambiguous questions, validating generated SQL, and measuring the system's reliability.
1. Core features we will integrate

1. Natural-language-to-SQL engine
Users ask questions such as "Show the top 10 customers by total spending last month." The LLM converts the request into SQL for the selected database dialect.



2. Multi-database connection manager
Users connect their own databases or try a preloaded demo database. The application discovers schemas, tables, columns, relationships and supported data types.



3. Clarification engine
When a request is ambiguous, the system asks follow-up questions instead of guessing.
Example: "Show the best-performing products." The system asks whether performance means revenue, units sold, or profit.



4. SQL validation and safe execution
Validate query structure, enforce read-only permissions, restrict permitted operations, and apply query timeouts and row limits before execution.



5. Results and visualizations
Display returned records in sortable tables, offer appropriate charts, and provide an optional plain-English summary. Show the generated SQL so users can inspect it.



6. Evaluation harness
Measure SQL execution accuracy, result correctness, clarification quality, latency, failure rates and performance across different database engines.



2. Database engines we will support
We'll separate database engine from hosting location. PostgreSQL can be cloud-hosted or self-hosted; the same principle applies to MySQL and the other supported engines.
Priority	Database engine	Cloud	Local / private network
Phase 1	PostgreSQL	Yes	Later
Phase 1	MySQL	Yes	Later
Phase 2	Microsoft SQL Server	Yes	Yes
Phase 2	MariaDB	Yes	Yes
Phase 2	SQLite	File-based deployments	Yes
Phase 3	Oracle Database	Yes	Yes
Phase 4	Google BigQuery	Yes	Not applicable as a local server
Phase 4	Snowflake	Yes	Not applicable as a local server
Phase 4	Amazon Redshift	Yes	Not applicable as a local server
These are planned support targets, not integrations that already exist. Each engine needs its own tested connection, schema discovery and SQL-dialect handling.
Initial implementation: PostgreSQL and MySQL, plus a sample database for users who want to try the application without connecting their own data.
3. Local versus cloud database connectivity
Cloud-hosted databases
The cloud backend connects directly to reachable database endpoints using secure connections and suitable credentials. Examples include Neon PostgreSQL, Supabase PostgreSQL and managed MySQL services.



Local databases
A customer-installed connector or an approved private-network connection provides access to databases on a laptop, office server or private network. We will not require customers to expose database ports publicly.



The connection wizard will collect the appropriate information for each database type: host or endpoint, port, database or service name, username, credentials or supported authentication, and SSL/TLS settings where applicable. SQLite will instead require access to an authorized database file.
4. Technology stack
Layer	Planned technology	Purpose
Frontend	React + Tailwind CSS	Chat interface, connections, tables and charts
Backend	FastAPI + Python	API endpoints and orchestration
LLM	Gemini initially; local models as an option	SQL generation and clarification
Agent workflow	LangGraph	Manage multi-step generation, clarification and recovery
Database connectivity	SQLAlchemy and appropriate drivers	Connect to supported relational databases
SQL analysis	SQLGlot	Parse SQL, handle dialects and help validate queries
Application database	PostgreSQL on Neon	Store application users, connection metadata and evaluation records
Deployment	Docker, Render and Vercel	Package backend and deploy application services
Testing	Pytest and a dedicated evaluation dataset	Automated tests and quality measurement
The LLM will receive only the relevant schema information and necessary context, not database passwords. We'll keep database access, query execution and credential handling on the backend.
5. Production security requirements
These are core requirements, not optional enhancements.
- Authentication and authorization: users can access only their own connections and permitted data.
- Credential protection: encrypt stored secrets, restrict access, redact logs and never place credentials in prompts.
- Least privilege: use read-only database accounts by default.
- SQL safety: parse generated queries, enforce permitted operations and validate against the target engine.
- Execution controls: enforce timeouts, result-size limits, resource limits and cancellation where supported.
- Network security: use TLS, restrict network access and avoid publicly exposing private databases.
- Data privacy: minimize data sent to the LLM, apply tenant isolation, and avoid logging sensitive query results unnecessarily.
- Failure recovery: handle connection failures, unsupported SQL, schema changes and invalid queries without blindly retrying unsafe operations.
SQL parsing alone is not a security boundary; database permissions and execution controls must independently restrict what a generated query can do.
6. Complete user workflow
This is the workflow the finished application should support.
#chatgpt-mermaid-_r_1s0_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-_r_1s0_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_1s0_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_1s0_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-_r_1s0_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-_r_1s0_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-_r_1s0_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-_r_1s0_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-_r_1s0_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-_r_1s0_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-_r_1s0_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-_r_1s0_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_1s0_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_1s0_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-_r_1s0_ p{margin:0;}#chatgpt-mermaid-_r_1s0_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_1s0_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_1s0_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_1s0_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-_r_1s0_ .label text,#chatgpt-mermaid-_r_1s0_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_1s0_ .node rect,#chatgpt-mermaid-_r_1s0_ .node circle,#chatgpt-mermaid-_r_1s0_ .node ellipse,#chatgpt-mermaid-_r_1s0_ .node polygon,#chatgpt-mermaid-_r_1s0_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-_r_1s0_ .rough-node .label text,#chatgpt-mermaid-_r_1s0_ .node .label text,#chatgpt-mermaid-_r_1s0_ .image-shape .label,#chatgpt-mermaid-_r_1s0_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-_r_1s0_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-_r_1s0_ .rough-node .label,#chatgpt-mermaid-_r_1s0_ .node .label,#chatgpt-mermaid-_r_1s0_ .image-shape .label,#chatgpt-mermaid-_r_1s0_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-_r_1s0_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-_r_1s0_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_1s0_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-_r_1s0_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-_r_1s0_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-_r_1s0_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-_r_1s0_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-_r_1s0_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-_r_1s0_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-_r_1s0_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-_r_1s0_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_1s0_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_1s0_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-_r_1s0_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_1s0_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-_r_1s0_ .icon-shape,#chatgpt-mermaid-_r_1s0_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-_r_1s0_ .icon-shape p,#chatgpt-mermaid-_r_1s0_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-_r_1s0_ .icon-shape .label rect,#chatgpt-mermaid-_r_1s0_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-_r_1s0_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-_r_1s0_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-_r_1s0_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-_r_1s0_ [data-look="neo"].node rect,#chatgpt-mermaid-_r_1s0_ [data-look="neo"].cluster rect,#chatgpt-mermaid-_r_1s0_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-_r_1s0_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_1s0_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-_r_1s0_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-_r_1s0_-gradient);stroke-width:1px;}#chatgpt-mermaid-_r_1s0_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_1s0_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-_r_1s0_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-_r_1s0_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_1s0_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-_r_1s0_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-_r_1s0_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_1s0_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-_r_1s0_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_1s0_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-_r_1s0_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-_r_1s0_ .node tspan[font-weight="normal"],#chatgpt-mermaid-_r_1s0_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-_r_1s0_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-_r_1s0_ .node rect,#chatgpt-mermaid-_r_1s0_ .node circle,#chatgpt-mermaid-_r_1s0_ .node ellipse,#chatgpt-mermaid-_r_1s0_ .node polygon,#chatgpt-mermaid-_r_1s0_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_1s0_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-_r_1s0_ .node.mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-_r_1s0_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-_r_1s0_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_1s0_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}User signs inChoose databaseDemo databaseConnect cloud databaseConnect local or privatedatabaseTest connection and discoverschemaUser asks question in EnglishRequest ambiguous?Ask clarificationGenerate SQL for target dialectValidate query and permissionsExplain issue or safelyregenerateExecute with limitsDisplay table, SQL and optionalchartRecord evaluation metricsYesNoRejectedApproved





7. Evaluation harness
We will build a repeatable test suite rather than judging the project only by a few successful demos.
Metric	What it measures
Execution accuracy	Whether the generated query executes successfully
Result correctness	Whether its returned data matches the expected answer
Clarification quality	Whether the system identifies ambiguity and asks useful questions
SQL safety	Whether prohibited operations are blocked
Schema grounding	Whether generated SQL uses valid tables and columns
Latency	How long the complete workflow takes
Recovery rate	Whether recoverable failures are handled successfully
We'll test straightforward filtering, aggregations, joins, date ranges, nested queries, ambiguous questions, invalid requests, permission restrictions and dialect-specific behavior.
8. Implementation roadmap
Project implementation checklist
0/19



Phase 1 — Foundation
[ ] Set up React, FastAPI and deployment
[ ] Create the demo PostgreSQL database on Neon
[ ] Connect PostgreSQL and MySQL
[ ] Build schema discovery and basic Text-to-SQL
[ ] Add query validation and read-only execution


Phase 2 — Intelligence
[ ] Build LangGraph clarification workflow
[ ] Add SQL error handling and bounded retries
[ ] Display tables, generated SQL and charts
[ ] Add conversation context and follow-up questions


Phase 3 — Multi-database
[ ] Add SQL Server, MariaDB and SQLite
[ ] Introduce the database adapter interface
[ ] Add Oracle and cloud analytics integrations in later releases


Phase 4 — Local connectivity
[ ] Design a customer-installed local connector
[ ] Implement authenticated outbound communication
[ ] Support local and private-network databases securely


Phase 5 — Production hardening
[ ] Add evaluation datasets and automated benchmarks
[ ] Implement tenant isolation and credential protection
[ ] Test timeouts, limits, failures and concurrent users
[ ] Add monitoring, audit events and deployment documentation


Final scope decision
We're building a multi-database Text-to-SQL platform with clarification, safe execution and evaluation.
The initial release will focus on PostgreSQL and MySQL, a ready-to-use demo database, schema-aware SQL generation, clarification, secure query execution and a polished results interface. Additional SQL engines and secure local connectivity will follow through a common adapter architecture.
The objective is not merely to make an LLM write SQL. It is to make a system that can connect to the right database, understand the user's intent, generate an appropriate query, execute it safely and demonstrate that its results are correct.