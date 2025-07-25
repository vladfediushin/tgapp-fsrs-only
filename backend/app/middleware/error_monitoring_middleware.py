"""
Error Monitoring Middleware for FastAPI
Integrates production error monitoring with FastAPI requests
"""

import uuid
import time
import json
from typing import Callable, Optional
from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from ..utils.error_monitoring import (
    get_error_monitor,
    create_error_context_from_request,
    ErrorContext
)

class ErrorMonitoringMiddleware(BaseHTTPMiddleware):
    """Middleware to monitor and report errors in FastAPI applications"""
    
    def __init__(self, app: ASGIApp, enable_request_logging: bool = True):
        super().__init__(app)
        self.enable_request_logging = enable_request_logging
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Start timing
        start_time = time.time()
        
        # Get error monitor
        error_monitor = get_error_monitor()
        
        try:
            # Process request
            response = await call_next(request)
            
            # Log successful request if enabled
            if self.enable_request_logging and error_monitor:
                duration = time.time() - start_time
                await self._log_request(request, response, duration)
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except HTTPException as http_exc:
            # Handle HTTP exceptions (4xx, 5xx)
            duration = time.time() - start_time
            
            if error_monitor and http_exc.status_code >= 500:
                # Report server errors
                context = await create_error_context_from_request(request)
                context.request_id = request_id
                
                additional_data = {
                    "status_code": http_exc.status_code,
                    "duration": duration,
                    "detail": http_exc.detail
                }
                
                await error_monitor.report_error(
                    Exception(f"HTTP {http_exc.status_code}: {http_exc.detail}"),
                    context,
                    additional_data
                )
            
            # Return HTTP exception response
            return JSONResponse(
                status_code=http_exc.status_code,
                content={"detail": http_exc.detail, "request_id": request_id},
                headers={"X-Request-ID": request_id}
            )
            
        except Exception as exc:
            # Handle unexpected exceptions
            duration = time.time() - start_time
            
            if error_monitor:
                context = await create_error_context_from_request(request)
                context.request_id = request_id
                
                # Try to get request body for context
                try:
                    if hasattr(request, '_body'):
                        body = await request.body()
                        if body:
                            context.request_body = json.loads(body.decode())
                except:
                    pass  # Ignore body parsing errors
                
                additional_data = {
                    "duration": duration,
                    "unexpected_error": True
                }
                
                error_id = await error_monitor.report_error(exc, context, additional_data)
                
                # Return error response with error ID
                return JSONResponse(
                    status_code=500,
                    content={
                        "detail": "Internal server error",
                        "error_id": error_id,
                        "request_id": request_id
                    },
                    headers={"X-Request-ID": request_id}
                )
            else:
                # Fallback if error monitor not available
                return JSONResponse(
                    status_code=500,
                    content={
                        "detail": "Internal server error",
                        "request_id": request_id
                    },
                    headers={"X-Request-ID": request_id}
                )
    
    async def _log_request(self, request: Request, response: Response, duration: float):
        """Log request details for monitoring"""
        error_monitor = get_error_monitor()
        if not error_monitor:
            return
        
        # Log slow requests as warnings
        if duration > 5.0:  # 5 second threshold
            context = await create_error_context_from_request(request)
            context.request_id = request.state.request_id
            
            additional_data = {
                "duration": duration,
                "status_code": response.status_code,
                "slow_request": True
            }
            
            await error_monitor.report_error(
                Exception(f"Slow request: {duration:.2f}s"),
                context,
                additional_data
            )

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for detailed request/response logging"""
    
    def __init__(self, app: ASGIApp, log_bodies: bool = False):
        super().__init__(app)
        self.log_bodies = log_bodies
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        import logging
        logger = logging.getLogger("request_logger")
        
        start_time = time.time()
        request_id = getattr(request.state, 'request_id', 'unknown')
        
        # Log request
        log_data = {
            "request_id": request_id,
            "method": request.method,
            "url": str(request.url),
            "headers": dict(request.headers),
            "client": request.client.host if request.client else None,
        }
        
        if self.log_bodies:
            try:
                body = await request.body()
                if body:
                    log_data["body"] = body.decode()
            except:
                pass
        
        logger.info(f"REQUEST: {json.dumps(log_data, default=str)}")
        
        # Process request
        response = await call_next(request)
        
        # Log response
        duration = time.time() - start_time
        response_data = {
            "request_id": request_id,
            "status_code": response.status_code,
            "duration": duration,
            "headers": dict(response.headers),
        }
        
        logger.info(f"RESPONSE: {json.dumps(response_data, default=str)}")
        
        return response

# Utility functions for manual error reporting
async def report_business_logic_error(
    request: Request,
    error: Exception,
    additional_context: Optional[dict] = None
):
    """Report business logic errors with request context"""
    error_monitor = get_error_monitor()
    if not error_monitor:
        return
    
    context = await create_error_context_from_request(request)
    if hasattr(request.state, 'request_id'):
        context.request_id = request.state.request_id
    if hasattr(request.state, 'user_id'):
        context.user_id = request.state.user_id
    
    await error_monitor.report_error(error, context, additional_context)

async def report_external_api_error(
    request: Request,
    api_name: str,
    error: Exception,
    response_data: Optional[dict] = None
):
    """Report external API errors"""
    error_monitor = get_error_monitor()
    if not error_monitor:
        return
    
    context = await create_error_context_from_request(request)
    if hasattr(request.state, 'request_id'):
        context.request_id = request.state.request_id
    
    additional_data = {
        "external_api": api_name,
        "api_response": response_data
    }
    
    await error_monitor.report_error(error, context, additional_data)

async def report_database_error(
    request: Request,
    operation: str,
    error: Exception,
    query_info: Optional[dict] = None
):
    """Report database errors with query context"""
    error_monitor = get_error_monitor()
    if not error_monitor:
        return
    
    context = await create_error_context_from_request(request)
    if hasattr(request.state, 'request_id'):
        context.request_id = request.state.request_id
    
    additional_data = {
        "database_operation": operation,
        "query_info": query_info
    }
    
    await error_monitor.report_error(error, context, additional_data)