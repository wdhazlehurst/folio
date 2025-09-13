export interface Expense {
    id: string;
    userId?: string;
    title: string;
    amount: number;
    category: string;
    description?: string;
    date: Date;
}

/** Used in frontend components */
export interface FrontendExpense {
    id: string;
    title: string;
    amount: number;
    category: string;
    date: Date;
}

/**
 * Client -> Server: data required to create new expense
 * Backend fills in userId + id automatically
 */
export interface NewExpense {
    title: string;
    amount: number;
    category: string;
    description?: string;
    date: string;
}


export interface NewExpenseCategory {
    title: string;
    description: string;
}

export interface ExpenseCategory {
    id: string;
    title: string;
    description?: string;
}
