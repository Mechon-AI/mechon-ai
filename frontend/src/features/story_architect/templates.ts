import type { StoryTemplate } from '../../types/story_architect'

export const STORY_TEMPLATES: StoryTemplate[] = [
  {
    id: 'storytelling',
    title: 'Interactive Narrative & Fiction',
    description: 'Structured multi-turn worldbuilding, character development, rising tension, and climactic resolution.',
    interaction_type: 'storytelling',
    default_spec: {
      premise: 'A dystopian investigator traces an untraceable synthetic anomaly across the rain-soaked megacity.',
      world_environment: 'High-tech lower tier with neon alleyways, monolithic orbital corporate headquarters above cloudline.',
      main_conflict: 'Exposing a corporate cyber-conspiracy before operational termination by black-budget enforcers.',
      expected_assistant_behavior: 'Atmospheric narrative cadence with vivid sensory descriptions and sharp character dialogues.',
      constraints_forbidden_developments: 'Do not resolve the mystery prematurely in early turns; maintain suspense and internal coherence.'
    },
    default_milestones: [
      {
        title: 'Introduction & Scene Setting',
        description: 'Introduce the protagonist, initial environment, and initial catalyst.',
        objective: 'Establish atmospheric narrative voice and setting constraints'
      },
      {
        title: 'Inciting Incident',
        description: 'Introduce the disruptive evidence or encounter that spurs action.',
        objective: 'Trigger investigation and initial friction'
      },
      {
        title: 'Rising Complication',
        description: 'Escalate the dilemma with unexpected revelation or hostile confrontation.',
        objective: 'Deepen narrative stakes and challenge character resolve'
      },
      {
        title: 'Climax & Confrontation',
        description: 'Direct confrontation with the central opposition or dilemma.',
        objective: 'High-stakes choice and dramatic culmination'
      },
      {
        title: 'Resolution & Denouement',
        description: 'Synthesize outcomes and establish new equilibrium.',
        objective: 'Coherent thematic closure'
      }
    ]
  },
  {
    id: 'interactive_roleplay',
    title: 'Dynamic Character Roleplay',
    description: 'Immersive persona fidelity, emotional nuance, moral dilemmas, and relationship state progression.',
    interaction_type: 'interactive_roleplay',
    default_spec: {
      premise: 'An eccentric archivist in an ancient clockwork library guards forbidden astrological charts.',
      world_environment: 'Dusty spiraling galleries, whirring brass orrery, candlelight and forgotten manuscripts.',
      main_conflict: 'Deciding whether to trust the visiting seeker with the catastrophic star prophecy.',
      expected_assistant_behavior: 'Stay firmly in-character as the archivist: witty, cautious, guarded yet intellectually curious.',
      constraints_forbidden_developments: 'Never break character or speak as an impartial AI assistant.'
    },
    default_milestones: [
      {
        title: 'Initial Encounter',
        description: 'Assess visitor intentions and establish persona posture.',
        objective: 'Establish authentic character voice and distinct worldview'
      },
      {
        title: 'Probing & Hesitation',
        description: 'Exchange cryptic knowledge and test visitor sincerity.',
        objective: 'Demonstrate relational depth and personality nuance'
      },
      {
        title: 'Revelation of the Secret',
        description: 'Unveil critical lore or make a fateful trade.',
        objective: 'Engage with core conflict and raise emotional investment'
      },
      {
        title: 'Pivotal Accord or Departure',
        description: 'Form a pact or part ways under impending threat.',
        objective: 'Conclude encounter with lasting character impact'
      }
    ]
  },
  {
    id: 'technical_discussion',
    title: 'Technical Architecture & Deep Inquiry',
    description: 'Rigorous engineering discussion exploring system trade-offs, scalability, edge cases, and verifiable design.',
    interaction_type: 'technical_discussion',
    default_spec: {
      premise: 'Designing a low-latency distributed event streaming engine capable of sub-millisecond p99 replication.',
      world_environment: 'High-throughput cloud-native microservices topology with Raft consensus and NVMe tiering.',
      main_conflict: 'Balancing linearizable consistency guarantees against replication latency under partition risk.',
      expected_assistant_behavior: 'Senior principal distributed systems engineer: analytical, mathematically sound, pragmatic about trade-offs.',
      constraints_forbidden_developments: 'Never give superficial or generic advice; specify exact algorithms, data structures, and invariants.'
    },
    default_milestones: [
      {
        title: 'System Requirements & SLA Definition',
        description: 'Clarify throughput, latency targets, and durability requirements.',
        objective: 'Establish rigorous system boundary and invariant constraints'
      },
      {
        title: 'Consensus & Replication Topology',
        description: 'Evaluate Raft vs Paxos variants and zero-copy WAL journaling.',
        objective: 'Analyze algorithmic trade-offs with explicit failover models'
      },
      {
        title: 'Storage Engine & Concurrency Primitives',
        description: 'Specify memory-mapped ring buffers, lock-free queues, and cache locality.',
        objective: 'Deliver concrete implementation patterns and memory layout'
      },
      {
        title: 'Fault Injection & Split-Brain Mitigation',
        description: 'Stress-test partition tolerance, split-brain scenarios, and poison pill messages.',
        objective: 'Exhaustively audit reliability, recovery, and observability'
      }
    ]
  },
  {
    id: 'educational_tutoring',
    title: 'Socratic Educational Tutoring',
    description: 'Active inquiry learning, intuition building, diagnostic assessment, and step-by-step concept mastery.',
    interaction_type: 'educational_tutoring',
    default_spec: {
      premise: 'Guiding an engineering student to intuitively derive backpropagation and chain rule in neural networks.',
      world_environment: 'Collaborative interactive whiteboard session.',
      main_conflict: 'Overcoming rote memorization to achieve deep geometric and algebraic intuition.',
      expected_assistant_behavior: 'Empathetic Socratic tutor: ask guiding questions, celebrate breakthrough insights, gently correct misconceptions.',
      constraints_forbidden_developments: 'Never dump full answers without first checking understanding and asking probing questions.'
    },
    default_milestones: [
      {
        title: 'Foundational Diagnostic',
        description: 'Check understanding of scalar derivatives and computational graphs.',
        objective: 'Identify prior intuition and conceptual gaps'
      },
      {
        title: 'Chain Rule Visualization',
        description: 'Deconstruct composite function sensitivity step by step.',
        objective: 'Develop geometric intuition for error gradients'
      },
      {
        title: 'Vector / Matrix Generalization',
        description: 'Extend scalar derivation to weight matrices and Jacobians.',
        objective: 'Master tensor dimensional alignment and gradient routing'
      },
      {
        title: 'Synthesis & Self-Explanation',
        description: 'Ask the student to synthesize backprop mechanics in their own words.',
        objective: 'Verify complete self-directed concept mastery'
      }
    ]
  },
  {
    id: 'interview_simulation',
    title: 'Rigorous Interview Simulation',
    description: 'Behavioral and technical candidate assessment using structured STAR evaluation and adaptive questioning.',
    interaction_type: 'interview_simulation',
    default_spec: {
      premise: 'Staff Software Engineer interview evaluating distributed systems leadership and production incident handling.',
      world_environment: 'Formal video interview setting.',
      main_conflict: 'Evaluating technical depth, humility, and high-pressure operational judgment.',
      expected_assistant_behavior: 'Experienced engineering leader: polite, sharp, probing beneath polished resumes for authentic experience.',
      constraints_forbidden_developments: 'Do not accept vague buzzwords; probe for specific metrics, team dynamics, and postmortem lessons.'
    },
    default_milestones: [
      {
        title: 'Opening & Behavioral Baseline',
        description: 'Set expectations and explore a high-stakes project background.',
        objective: 'Establish communicative baseline and leadership scope'
      },
      {
        title: 'Crisis & Production Postmortem',
        description: 'Deep-dive into a major outage or architectural failure.',
        objective: 'Evaluate technical composure, root cause analysis, and accountability'
      },
      {
        title: 'System Design Challenge',
        description: 'Present an ambiguous scale problem with shifting constraints.',
        objective: 'Probe trade-off justification and architectural foresight'
      },
      {
        title: 'Debrief & Assessment Synthesis',
        description: 'Allow candidate questions and synthesize candidate performance.',
        objective: 'Conclude interview with balanced evaluative notes'
      }
    ]
  },
  {
    id: 'debate',
    title: 'Dialectical Motion & Debate',
    description: 'Structured formal debate with propositions, cross-examination, rebuttal, and comparative synthesis.',
    interaction_type: 'debate',
    default_spec: {
      premise: 'Resolved: Open-weight AI models represent a net benefit to global security compared to closed-weights.',
      world_environment: 'Formal parliamentary debate hall.',
      main_conflict: 'Democratized scrutiny vs proliferation of dual-use capabilities.',
      expected_assistant_behavior: 'Skilled debater: articulate, logically rigorous, respectful, dissecting faulty premises with surgical precision.',
      constraints_forbidden_developments: 'Adhere strictly to formal debate conventions; avoid logical fallacies or emotional hyperbole.'
    },
    default_milestones: [
      {
        title: 'Proposition Constructive',
        description: 'Present the affirmative framework and primary arguments.',
        objective: 'Establish burden of proof and core evidentiary pillars'
      },
      {
        title: 'Cross-Examination & Rebuttal',
        description: 'Interrogate opponent claims and highlight causal flaws.',
        objective: 'Expose assumptions and test argumentative resilience'
      },
      {
        title: 'Defense & Rebuilding',
        description: 'Rebuild key contentions under scrutiny and isolate deciding issues.',
        objective: 'Deepen nuance and compare ethical frameworks'
      },
      {
        title: 'Closing Crystallization',
        description: 'Synthesize round and explain comparative advantage.',
        objective: 'Deliver persuasive synthesis and conclusive verdict'
      }
    ]
  },
  {
    id: 'customer_support_simulation',
    title: 'Empathetic Customer Support Escalation',
    description: 'De-escalation of frustrated users, systematic technical diagnosis, clear remediation, and relationship repair.',
    interaction_type: 'customer_support_simulation',
    default_spec: {
      premise: 'A critical enterprise customer faces unexpected billing lockouts right before end-of-quarter payroll.',
      world_environment: 'High-priority enterprise support portal.',
      main_conflict: 'Immediate crisis resolution vs enterprise security and verification protocols.',
      expected_assistant_behavior: 'Elite Tier-3 enterprise support specialist: deeply empathetic, fast, clear, and reassuring.',
      constraints_forbidden_developments: 'Never dismiss customer urgency or offer robotic unhelpful canned responses.'
    },
    default_milestones: [
      {
        title: 'Acknowledge & De-escalate',
        description: 'Validate customer stress and confirm immediate emergency priority.',
        objective: 'Establish human empathy and diffuse tension'
      },
      {
        title: 'Diagnostic Isolation',
        description: 'Pinpoint the exact cause of account restriction without bureaucratic delays.',
        objective: 'Identify root failure accurately and transparently'
      },
      {
        title: 'Emergency Remediation',
        description: 'Execute provisional unlock and restore service access.',
        objective: 'Deliver immediate functional relief with verified safety'
      },
      {
        title: 'Post-Incident Prevention',
        description: 'Provide follow-up SLA assurances and preventative safeguards.',
        objective: 'Restore customer trust and seal relationship'
      }
    ]
  }
]
