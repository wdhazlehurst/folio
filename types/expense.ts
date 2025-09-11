export interface Expense {
    id: string;
    userId?: string;
    amount: number;
    category: string;
    description?: string;
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
    date: Date;
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
