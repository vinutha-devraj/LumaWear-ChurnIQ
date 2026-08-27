"""
backend/schemas.py

Pydantic models for request validation and response serialization.
Supports:
1. LumaWear 21-feature schema (with sensible defaults for optional fields)
2. Benchmark dataset schema (backward compatibility)
3. Prediction responses with continuous probability, risk level, timeline, SHAP, and recommendations.
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any


# ─── LumaWear Customer Input Schema ───────────────────────────────────────────

class LumaWearCustomerInput(BaseModel):
    """
    Input schema for LumaWear single customer prediction requests.
    Supports all 21 LumaWear-native behavioral and order features.
    Missing/optional fields are handled gracefully.
    """
    model_config = ConfigDict(
        extra="allow",
        json_schema_extra={
            "example": {
                "user_id": "u-0010",
                "tenure_days": 49.0,
                "days_since_last_login": 2.0,
                "days_since_last_activity": 2.0,
                "login_count_30d": 3.0,
                "active_days_30d": 3.0,
                "page_views_30d": 11.0,
                "product_views_30d": 11.0,
                "cart_actions_30d": 2.0,
                "wishlist_actions_30d": 0.0,
                "order_count": 1.0,
                "orders_30d": 0.0,
                "days_since_last_order": 40.0,
                "total_spend": 340.40,
                "spend_30d": 0.0,
                "average_order_value": 340.40,
                "preferred_order_category": "Outerwear",
                "order_frequency": 0.61,
                "distinct_products_viewed_30d": 8.0,
                "distinct_categories_ordered": 1.0,
                "items_per_order": 2.0,
                "activity_event_count_30d": 27.0,
            }
        }
    )

    user_id:                      Optional[str]   = Field(None,  description="Unique LumaWear user identifier")
    tenure_days:                  Optional[float] = Field(None,  description="Days since user registration")
    days_since_last_login:        Optional[float] = Field(None,  description="Days since last auth login")
    days_since_last_activity:     Optional[float] = Field(None,  description="Days since last activity event")
    login_count_30d:              Optional[float] = Field(0.0,   description="Number of logins in past 30 days")
    active_days_30d:              Optional[float] = Field(0.0,   description="Distinct active days in past 30 days")
    page_views_30d:               Optional[float] = Field(0.0,   description="Page views in past 30 days")
    product_views_30d:            Optional[float] = Field(0.0,   description="Product views in past 30 days")
    cart_actions_30d:             Optional[float] = Field(0.0,   description="Cart actions (add/remove/update) in past 30 days")
    wishlist_actions_30d:         Optional[float] = Field(0.0,   description="Wishlist toggles in past 30 days")
    order_count:                  Optional[float] = Field(0.0,   description="Total lifetime successful orders")
    orders_30d:                   Optional[float] = Field(0.0,   description="Successful orders in past 30 days")
    days_since_last_order:        Optional[float] = Field(None,  description="Days since last successful order")
    total_spend:                  Optional[float] = Field(0.0,   description="Total lifetime spend ($)")
    spend_30d:                    Optional[float] = Field(0.0,   description="Spend in past 30 days ($)")
    average_order_value:          Optional[float] = Field(None,  description="Average order value ($)")
    preferred_order_category:     Optional[str]   = Field(None,  description="Most ordered product category")
    order_frequency:              Optional[float] = Field(0.0,   description="Orders per 30-day period")
    distinct_products_viewed_30d: Optional[float] = Field(0.0,   description="Distinct products viewed in past 30 days")
    distinct_categories_ordered:  Optional[float] = Field(0.0,   description="Distinct product categories ordered")
    items_per_order:              Optional[float] = Field(None,  description="Average items per order")
    activity_event_count_30d:     Optional[float] = Field(0.0,   description="Total activity events in past 30 days")


# ─── Benchmark Customer Input Schema (Backward Compatibility) ─────────────────

class BenchmarkCustomerInput(BaseModel):
    """Input schema for legacy benchmark E-Commerce model."""
    model_config = ConfigDict(extra="allow")

    Tenure:                      Optional[float] = Field(None,  description="Months with company")
    WarehouseToHome:             Optional[float] = Field(None,  description="Distance warehouse to home (km)")
    HourSpendOnApp:              Optional[float] = Field(None,  description="Hours spent on app per day")
    NumberOfDeviceRegistered:    Optional[int]   = Field(1,     description="Number of devices registered")
    SatisfactionScore:           Optional[int]   = Field(3,     description="Customer satisfaction score (1-5)")
    NumberOfAddress:             Optional[int]   = Field(1,     description="Number of saved addresses")
    Complain:                    Optional[int]   = Field(0,     description="1 = raised complaint, 0 = no complaint")
    OrderAmountHikeFromlastYear: Optional[float] = Field(None,  description="% order amount increase from last year")
    CouponUsed:                  Optional[float] = Field(None,  description="Total coupons used last month")
    OrderCount:                  Optional[float] = Field(None,  description="Total orders last month")
    DaySinceLastOrder:           Optional[float] = Field(None,  description="Days since last order")
    CashbackAmount:              Optional[float] = Field(150.0, description="Average cashback received")
    CityTier:                    Optional[int]   = Field(1,     description="City tier: 1, 2, or 3")
    PreferredLoginDevice:        Optional[str]   = Field("Mobile Phone", description="Preferred login device")
    PreferredPaymentMode:        Optional[str]   = Field("Debit Card",   description="Preferred payment method")
    Gender:                      Optional[str]   = Field("Female",       description="Gender")
    PreferedOrderCat:            Optional[str]   = Field("Fashion",      description="Preferred order category")
    MaritalStatus:               Optional[str]   = Field("Single",       description="Marital status")


# Unified Flexible Customer Input
class CustomerInput(BaseModel):
    """
    Flexible input container that accepts LumaWear or Benchmark fields.
    """
    model_config = ConfigDict(extra="allow")


# ─── Live Customer Prediction Request ──────────────────────────────────────────

class LiveCustomerRequest(BaseModel):
    """Request schema for predicting churn of a live LumaWear customer by user_id."""
    model_config = ConfigDict(extra="allow")

    user_id: str = Field(..., min_length=1, description="LumaWear User ID (e.g., MongoDB ObjectId or custom user_id)")


# ─── Prediction Response ───────────────────────────────────────────────────────

class ShapFeature(BaseModel):
    feature:    str
    shap_value: float
    direction:  str  # "increases_churn" or "reduces_churn"


class RecommendationItem(BaseModel):
    driven_by:      str
    shap_impact:    Optional[float] = None
    recommendation: str
    priority:       str  # "High", "Medium", "Low"


class PredictionResponse(BaseModel):
    """
    Comprehensive prediction response returned for all prediction endpoints.
    """
    model_config = ConfigDict(extra="allow")

    customer_id:       Optional[str]                = None
    customer_input:    Optional[Dict[str, Any]]     = Field(default_factory=dict)
    churn_prediction:  int                          = Field(..., description="Binary threshold prediction: 0 or 1")
    churn_label:       str                          = Field(..., description="'Will Churn' or 'Will Not Churn'")
    churn_probability: float                        = Field(..., description="Continuous churn probability from 0.0 to 1.0")
    churn_percentage:  float                        = Field(..., description="Churn percentage from 0.0 to 100.0")
    risk_level:        str                          = Field(..., description="Risk tier: Low, Medium, High, or Very High")
    churn_timeline:    str                          = Field(..., description="Risk-oriented 90-day horizon description")
    top_shap_features: List[Dict[str, Any]]         = Field(default_factory=list)
    recommendations:   List[Dict[str, Any]]         = Field(default_factory=list)


class HealthResponse(BaseModel):
    status:       str
    active_model: str
    auc_cv:       Optional[float] = None


# ─── Batch Prediction Schemas ──────────────────────────────────────────────────

class BatchPredictionRequest(BaseModel):
    """
    Request schema for batch predicting multiple customer records.
    Each item is a dictionary of customer features (e.g. 21 LumaWear features or benchmark features).
    """
    model_config = ConfigDict(extra="allow")

    customers: List[Dict[str, Any]] = Field(default_factory=list, description="List of customer feature dictionaries")


class BatchPredictionResponse(BaseModel):
    """
    Response schema for batch customer predictions.
    """
    model_config = ConfigDict(extra="allow")

    predictions: List[PredictionResponse] = Field(default_factory=list, description="Individual prediction responses")
    total: int = Field(0, description="Total customers scored in this batch")
    active_model: str = Field("", description="Active model identifier")