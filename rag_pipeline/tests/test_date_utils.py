import pytest
from src.date_utils import resolve_day_reference

def test_resolve_day_reference():
    # No date mentioned -> today
    assert resolve_day_reference("What is the temperature?") == {"type": "single_day", "offset": 0}
    assert resolve_day_reference("Tell me the weather currently") == {"type": "single_day", "offset": 0}
    
    # Tomorrow
    assert resolve_day_reference("Will it rain tomorrow?") == {"type": "single_day", "offset": 1}
    
    # Day after tomorrow
    assert resolve_day_reference("Weather for the day after tomorrow") == {"type": "single_day", "offset": 2}
    
    # in N days
    assert resolve_day_reference("What about in 3 days?") == {"type": "single_day", "offset": 3}
    assert resolve_day_reference("Weather 5 days from now") == {"type": "single_day", "offset": 5}
    assert resolve_day_reference("Weather in two days") == {"type": "single_day", "offset": 2}
    
    # this week
    assert resolve_day_reference("How is the weather this week?") == {"type": "range", "start_offset": 0, "end_offset": 6}
    assert resolve_day_reference("Forecast for the next 7 days") == {"type": "range", "start_offset": 0, "end_offset": 6}
    
    # out of range
    assert resolve_day_reference("What is the weather in 10 days?") == {"type": "out_of_range", "offset": 10}
    assert resolve_day_reference("Weather 8 days from now") == {"type": "out_of_range", "offset": 8}
    assert resolve_day_reference("Weather in ten days") == {"type": "out_of_range", "offset": 10}

