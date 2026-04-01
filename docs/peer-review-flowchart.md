# Peer Review Workflow — Architecture Flowchart

## High-Level Flow

```mermaid
flowchart TD
    START(["/shipit:peer-review"]) --> LOAD["Step 1: Load CLAUDE.md context"]
    LOAD --> SOURCE{"Step 2: Choose\nreview source"}

    SOURCE -->|Jira| JIRA_SCOPE{"Step 2J: Scope?\n(mine / all)"}
    SOURCE -->|GitLab| GL_FETCH["Step 3G: Fetch MRs\nassigned to me\n(GitLab MCP)"]

    JIRA_SCOPE -->|Assigned to me| JIRA_FETCH_MINE["Step 3J: Jira MCP\nstatus = Peer Review\nAND assignee = me"]
    JIRA_SCOPE -->|All tickets| JIRA_FETCH_ALL["Step 3J: Jira MCP\nstatus = Peer Review"]

    JIRA_FETCH_MINE --> JIRA_LIST["Step 4J: Display\nticket list"]
    JIRA_FETCH_ALL --> JIRA_LIST
    JIRA_LIST --> JIRA_SELECT["Step 5J: User\nselects ticket"]

    GL_FETCH --> GL_LIST["Step 4G: Display\nMR list"]
    GL_LIST --> GL_SELECT["Step 5G: User\nselects MR"]

    JIRA_SELECT --> EXTRACT_MR["Step 6J: Extract MR URL"]
    GL_SELECT --> CONVERGE["Step 7: git fetch origin"]
    EXTRACT_MR --> CONVERGE

    CONVERGE -->|Fetch fails| BLOCK_FETCH[/"HARD GATE:\nNetwork/auth error.\nWorkflow stops."/]
    CONVERGE -->|Fetch OK| GET_BRANCH["Step 8: Get MR\nsource branch\n(GitLab MCP)"]

    GET_BRANCH --> SPAWN["Spawn\nshipit-peer-reviewer\nagent"]

    SPAWN --> AGENT_REVIEW["Agent performs\nfull code review\n(see Agent Flow)"]
    AGENT_REVIEW --> DISPLAY["Step 9: Display\nreview summary\nto user"]
    DISPLAY --> DONE([Done])

    style START fill:#4CAF50,color:#fff
    style DONE fill:#4CAF50,color:#fff
    style BLOCK_FETCH fill:#f44336,color:#fff
    style SOURCE fill:#FF9800,color:#fff
    style SPAWN fill:#2196F3,color:#fff
```

## MR URL Extraction (Jira Flow — Step 6J)

```mermaid
flowchart TD
    START["Get Jira ticket details"] --> F1{"1. Custom fields\ncontain GitLab URL?"}
    F1 -->|Yes| FOUND["MR URL found ✓"]
    F1 -->|No| F2{"2. Remote issue\nlinks have MR?"}
    F2 -->|Yes| FOUND
    F2 -->|No| F3{"3. Description\ncontains MR URL?"}
    F3 -->|Yes| FOUND
    F3 -->|No| F4{"4. Comments\ncontain MR URL?"}
    F4 -->|Yes| FOUND_COMMENT["Use most recent\ncomment with MR URL ✓"]
    F4 -->|No| STOP[/"No MR URL found.\nChecked: fields, remote links,\ndescription, comments.\nWorkflow stops."/]

    style FOUND fill:#4CAF50,color:#fff
    style FOUND_COMMENT fill:#4CAF50,color:#fff
    style STOP fill:#f44336,color:#fff
```

## Agent Internal Flow

```mermaid
flowchart TD
    INPUT["Input: MR URL, Ticket Key,\nSource Branch, Target Branch,\nGitLab Project Path"] --> PARSE["Step 1: Parse MR URL\n→ project path + IID"]
    PARSE --> FETCH_MR["Step 2: Fetch MR\nvia GitLab MCP\n(metadata + diff)"]

    FETCH_MR -->|MR not found| ERR_MR[/"Error: MR not found\nor no permissions"/]
    FETCH_MR -->|OK| REVIEW

    REVIEW["Step 3: HARD GATE\nCall /pr-review-toolkit:review-pr"] --> TOOLKIT

    subgraph TOOLKIT ["pr-review-toolkit (5 sub-agents)"]
        direction LR
        CR["Code\nReviewer"]
        SFH["Silent Failure\nHunter"]
        PTA["Test\nAnalyzer"]
        TDA["Type Design\nAnalyzer"]
        CA["Comment\nAnalyzer"]
    end

    TOOLKIT --> CATEGORIZE{"Step 4: Categorize\nverdict"}

    CATEGORIZE -->|"No CRITICAL\nNo IMPORTANT"| APPROVE["APPROVE"]
    CATEGORIZE -->|"Any CRITICAL or\n2+ IMPORTANT"| REQUEST["REQUEST\nCHANGES"]

    APPROVE --> POST_COMMENTS["Step 5: Post review\ncomments on GitLab MR"]
    REQUEST --> POST_COMMENTS

    POST_COMMENTS --> ACTION{"Step 6: Take action"}
    ACTION -->|Approved| DO_APPROVE["Approve MR\nvia GitLab MCP"]
    ACTION -->|Changes requested| NO_APPROVE["Do NOT approve\n(comments serve\nas documentation)"]

    DO_APPROVE --> HAS_FINDINGS{"CRITICAL or\nIMPORTANT\nfindings?"}
    NO_APPROVE --> HAS_FINDINGS

    HAS_FINDINGS -->|No| RETURN["Step 7: Return\nsummary"]
    HAS_FINDINGS -->|Yes| PATTERNS

    subgraph PATTERNS ["Step 6.5: Pattern Extraction (best-effort)"]
        direction TB
        P1["Filter CRITICAL +\nIMPORTANT findings"]
        P2["Generalize patterns\n(remove MR-specific details)"]
        P3["Read/create\nSKILL.md in project"]
        P4["Deduplicate\n(30 entry cap)"]
        P5["Commit on MR\nsource branch + push"]
        P1 --> P2 --> P3 --> P4 --> P5
    end

    PATTERNS --> HAS_CRITICAL{"Any CRITICAL\nfindings?"}

    HAS_CRITICAL -->|No| RETURN
    HAS_CRITICAL -->|Yes| ISSUES

    subgraph ISSUES ["Step 6.6: GitLab Issues (best-effort)"]
        direction TB
        I1["For each CRITICAL finding:\ncreate GitLab issue"]
        I2["Labels: peer-review,\ncritical, bug"]
        I1 --> I2
    end

    ISSUES --> RETURN
    RETURN --> END([Return to command])

    style INPUT fill:#2196F3,color:#fff
    style REVIEW fill:#ff5722,color:#fff
    style ERR_MR fill:#f44336,color:#fff
    style APPROVE fill:#4CAF50,color:#fff
    style REQUEST fill:#f44336,color:#fff
    style END fill:#4CAF50,color:#fff
```

## Branch Strategy (Pattern Commits)

```mermaid
sequenceDiagram
    participant R as Reviewer Branch<br/>(e.g. Outage-2272)
    participant ST as Git Stash
    participant S as MR Source Branch<br/>(e.g. outage-2312)
    participant O as origin/outage-2312
    participant T as Target Branch<br/>(e.g. dev)

    Note over R: Reviewer is on their branch<br/>with 4-5 uncommitted changes
    R->>R: 1. Save current branch name
    R->>ST: 2. git stash push -u<br/>(staged + unstaged + untracked)
    Note over ST: Local changes<br/>safely stored
    R->>S: 3. git checkout outage-2312
    S->>S: git pull origin outage-2312
    S->>S: Write SKILL.md patterns
    S->>S: 4. git add + commit
    S->>O: 5. git push origin outage-2312
    Note over O: Patterns now<br/>in the MR
    S->>R: 6. git checkout Outage-2272
    ST->>R: 7. git stash pop
    Note over R: Back on reviewer's branch<br/>with all local changes restored ✓
    O-->>T: MR merges → patterns<br/>flow into dev ✓
```

## System Dependencies

```mermaid
graph LR
    subgraph Entry["Entry Points"]
        CMD["/shipit:peer-review\n(command)"]
    end

    subgraph Sources["Review Sources"]
        JIRA["Jira MCP\n(Atlassian)"]
        GL_SRC["GitLab MCP\n(list MRs)"]
    end

    subgraph Agent["shipit-peer-reviewer"]
        GL_DIFF["GitLab MCP\n(fetch diff)"]
        TOOLKIT["pr-review-toolkit\n(5 sub-agents)"]
        GL_COMMENT["GitLab MCP\n(post comments)"]
        GL_APPROVE["GitLab MCP\n(approve/reject)"]
        GL_ISSUE["GitLab MCP\n(create issues)"]
        GIT["Git\n(branch + push)"]
    end

    CMD -->|Jira flow| JIRA
    CMD -->|GitLab flow| GL_SRC
    CMD -->|spawns| Agent
    GL_DIFF --> TOOLKIT
    TOOLKIT --> GL_COMMENT
    GL_COMMENT --> GL_APPROVE
    GL_APPROVE --> GIT
    GIT --> GL_ISSUE

    style CMD fill:#4CAF50,color:#fff
    style TOOLKIT fill:#2196F3,color:#fff
    style JIRA fill:#FF9800,color:#fff
    style GL_SRC fill:#FF9800,color:#fff
```
