# The Chain

> An open-source Agent OS kernel for governed autonomous execution.

The Chain is an open-source Agent OS kernel that provides a governed execution environment for autonomous and semi-autonomous computational actors.

The project explores the foundational runtime primitives required for agents, orchestrated groups of agents, and subordinate Agent OSes to execute within locally governed boundaries while remaining composable into larger fabrics.

## Status

The Chain is in early development.

The initial work is focused on defining and proving the minimum responsibilities of an Agent OS kernel before introducing higher-level frameworks, dynamic discovery, federation, or enterprise control-plane capabilities.

## Core Principles

- Agent OSes are locally complete.
- Multiple autonomous actors can collaborate without direct knowledge of one another's identity, implementation, or topology.
- The kernel provides primitives; orchestration operates above them.
- Capability does not imply authority.
- Discovery does not imply trust or authorization.
- Participants depend on contracts and capabilities rather than topology.
- Existing distributed-systems patterns should be reused rather than reinvented.
- Implementation details should follow from kernel responsibilities, not define them.

## Foundational Primitives

The Chain currently defines seven foundational primitives:

1. **Execution**
2. **Resources**
3. **State**
4. **Authority**
5. **Communication**
6. **Supervision**
7. **Discovery**

The initial implementation will focus on the minimum kernel responsibility required for each primitive.

## Scope

The Chain is the runtime and control layer.

It is not, by definition:

- A workflow engine
- An orchestration framework
- A repository analyzer
- A self-healing system
- A domain-specific intelligence product

Those systems may be built on top of or operate within The Chain.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).
