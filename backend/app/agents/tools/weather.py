import httpx
from langchain_core.tools import tool

from app.core.config import settings


@tool
async def get_weather(city: str) -> str:
    """查询指定城市的当前天气（OpenWeatherMap API）。"""
    if not settings.OPENWEATHER_API_KEY:
        return f"[演示模式] {city} 当前天气：晴，25°C，湿度 60%（请配置 OPENWEATHER_API_KEY 获取真实数据）"

    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"q": city, "appid": settings.OPENWEATHER_API_KEY, "units": "metric", "lang": "zh_cn"}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
        if resp.status_code != 200:
            return f"天气查询失败: {resp.text}"
        data = resp.json()
        desc = data["weather"][0]["description"]
        temp = data["main"]["temp"]
        humidity = data["main"]["humidity"]
        return f"{city} 当前天气：{desc}，温度 {temp}°C，湿度 {humidity}%"
