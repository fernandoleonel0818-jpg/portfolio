

export interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export interface LeadData {
    projectType: string;
    goal: string;
    timeline: string;
    budget: string;
    contact: string;
    priority: 'alta' | 'media' | 'baja';
}