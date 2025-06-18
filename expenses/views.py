from django.shortcuts import render, HttpResponse
from rest_framework import generics, permissions
from .models import Expense, Category
from .serializers import ExpenseSerializer, CategorySerializer

# Create your views here.
class ExpenseView(generics.CreateAPIView):
    """
    View for handling expense-related operations.
    
    Attributes:
        request: The HTTP request.
    """
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, serializer):
        """
        Creating a new expense for a given user.
        
        Args:
            request: The HTTP request object.
        
        Returns:
            HttpResponse: Response after processing the POST request.
        """
        try:
            serializer.is_valid(raise_exception=True)
        except Exception as e:
            # TODO add logging
            return HttpResponse(f"Invalid data", status=400)
        serializer.save(user=self.request.user)
        return HttpResponse("Expense POST request handled")
    
    def get(self, request):
        """
        Handle GET requests to the expense view.
        
        Args:
            request: The HTTP request object.
        
        Returns:
            HttpResponse: Rendered expense page.
        """
        return HttpResponse("Expense View")