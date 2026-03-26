/**
 * AI Function Definitions
 * These are the tools the AI assistant can call to manage your office
 */

export const ASSISTANT_FUNCTIONS = [
    {
        type: 'function',
        function: {
            name: 'add_reminder',
            description: 'Add a new reminder with an optional due date to the user agenda',
            parameters: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'The reminder text' },
                    due_date: { type: 'string', description: 'Due date in YYYY-MM-DD format (optional)', nullable: true },
                },
                required: ['text'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'add_task',
            description: 'Add a new task to the general backlog',
            parameters: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'The task description' },
                },
                required: ['text'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'complete_item',
            description: 'Mark a reminder or task as completed',
            parameters: {
                type: 'object',
                properties: {
                    item_type: { type: 'string', enum: ['reminder', 'task'], description: 'Type of item' },
                    search_text: { type: 'string', description: 'Text to search for in the item list (partial match)' },
                },
                required: ['item_type', 'search_text'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'delete_item',
            description: 'Delete a reminder or task',
            parameters: {
                type: 'object',
                properties: {
                    item_type: { type: 'string', enum: ['reminder', 'task'], description: 'Type of item' },
                    search_text: { type: 'string', description: 'Text to search for in the item list (partial match)' },
                },
                required: ['item_type', 'search_text'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'write_journal',
            description: 'Write or append to the journal entry for a specific date',
            parameters: {
                type: 'object',
                properties: {
                    date: { type: 'string', description: 'Date in YYYY-MM-DD format. Use today if not specified.' },
                    content: { type: 'string', description: 'HTML content to write in the journal' },
                    append: { type: 'boolean', description: 'If true, append to existing content. If false, replace.' },
                },
                required: ['date', 'content'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_agenda',
            description: 'Get the current agenda: pending reminders, tasks, and today journal entry',
            parameters: {
                type: 'object',
                properties: {
                    date: { type: 'string', description: 'Date in YYYY-MM-DD format. Defaults to today.' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'search_entries',
            description: 'Search across journal entries, reminders, and tasks',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search query text' },
                },
                required: ['query'],
            },
        },
    },
];
