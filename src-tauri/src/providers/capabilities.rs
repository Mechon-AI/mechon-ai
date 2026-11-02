use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModelCapabilities {
    pub vision: bool,
    pub tool_use: bool,
    pub reasoning: bool,
    pub streaming: bool,
    pub structured_output: bool,
    pub json_mode: bool,
}

impl Default for ModelCapabilities {
    fn default() -> Self {
        Self {
            vision: false,
            tool_use: false,
            reasoning: false,
            streaming: true,
            structured_output: false,
            json_mode: true,
        }
    }
}

impl ModelCapabilities {
    pub fn all() -> Self {
        Self {
            vision: true,
            tool_use: true,
            reasoning: true,
            streaming: true,
            structured_output: true,
            json_mode: true,
        }
    }

    pub fn is_support_vision(&self) -> bool {
        self.vision
    }

    pub fn is_support_tool_use(&self) -> bool {
        self.tool_use
    }

    pub fn is_support_reasoning(&self) -> bool {
        self.reasoning
    }

    pub fn is_support_streaming(&self) -> bool {
        self.streaming
    }

    pub fn is_support_structured_output(&self) -> bool {
        self.structured_output
    }

    pub fn is_support_json_mode(&self) -> bool {
        self.json_mode
    }
}
