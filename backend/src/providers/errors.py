class LemmaBaseError(Exception):
    """Base class for all Lemma-related exceptions."""
    pass

class LemmaTimeoutError(LemmaBaseError):
    """Raised when a Lemma operation times out."""
    pass

class LemmaWorkflowError(LemmaBaseError):
    """Raised when a workflow fails to execute properly."""
    pass

class LemmaAuthenticationError(LemmaBaseError):
    """Raised when Lemma authentication (or token refresh) fails."""
    pass

class LemmaJSONValidationError(LemmaBaseError):
    """Raised when the JSON returned by Lemma is malformed or missing fields."""
    pass

class LemmaNetworkError(LemmaBaseError):
    """Raised when there is a network or HTTP error communicating with Lemma."""
    pass
