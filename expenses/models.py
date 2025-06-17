from django.db import models

# Create your models here.
class Expense(models.Model):
    """
    Model representing an expense.
    
    Attributes:
        description (str): Description of the expense.
        amount (Decimal): Amount of the expense.
        date (DateTimeField): Date and time when the expense was incurred.
    """
    title = models.CharField(max_length=32)
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    timestamp = models.DateTimeField(auto_now_add=True)
    category = models.ForeignKey(
        'ExpenseCategory',
        on_delete=models.CASCADE,
        related_name='expenses'
    )

    def __str__(self):
        return f"{self.description} - {self.amount} on {self.date}"

class ExpenseCategory(models.Model):
    """
    Model representing a category for expenses.
    
    Attributes:
        name (str): Name of the expense category.
    """
    name = models.CharField(max_length=32)
    description = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return self.name
