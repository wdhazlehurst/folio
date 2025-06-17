from django.shortcuts import render, HttpResponse

# Create your views here.
def index(request):
    """
    Render the index page.
    
    Args:
        request: The HTTP request object.
    
    Returns:
        HttpResponse: Rendered index page.
    """
    return HttpResponse("Expenses index")
