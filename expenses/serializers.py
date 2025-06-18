from rest_framework import serializers
from .models import Expense, Category

class ExpenseSerializer(serializers.ModelSerializer):
    """
    Serializer for the Expense model.
    
    Attributes:
        user (str): Username of the user who owns the expense.
        title (str): Title of the expense.
        description (str): Description of the expense.
        amount (float): Amount of the expense.
        timestamp (str): Timestamp when the expense was created.
        category (str): Name of the category associated with the expense.
    """
    
    class Meta:
        model = Expense
        fields = ['title', 'description', 'amount', 'category']


class CategorySerializer(serializers.ModelSerializer):
    """
    Serializer for the Category model.
    
    Attributes:
        user (str): Username of the user who owns the category.
        name (str): Name of the category.
        description (str): Description of the category.
    """
    
    class Meta:
        model = Category
        fields = ['name', 'description']