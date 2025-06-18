from django.db import models
from django.contrib.auth.models import User


class ExpenseCategory(models.Model):
    """
    Model representing a category for expenses. Each unique user can have customizable categories.
    
    Attributes:
        user (ForeignKey): User who owns the category, linked to Django's `User` model.
        name (str): Display title of the category.
        description (str): Optional description of the category.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='expense_categories'
    )
    name = models.CharField(max_length=32)
    description = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return self.name


class Expense(models.Model):
    """
    Model representing an expense.
    
    Attributes:
        user (ForeignKey): User who owns the expense, linked to Django's `User` model.
        title (str): Display name of the expense.
        description (str): Description of the expense.
        amount (Decimal): Dollar amount of the expense.
        timestamp (DateTimeField): Date and time when the expense was entered.
        category (ForeignKey): Categorization of the expense, linked to `ExpenseCategory`.
        date (DateTimeField): Date and time when the expense was incurred.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='expenses'
    )
    title = models.CharField(max_length=32)
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    timestamp = models.DateTimeField(auto_now_add=True)
    category = models.ForeignKey(
        ExpenseCategory,
        on_delete=models.PROTECT,
        blank=True,
        related_name='expenses'
    )

    def __str__(self):
        return f"{self.description} - {self.amount} on {self.date}"
