from flask import Flask
from flask_cors import CORS

from api.routes import register_routes
from config.settings import configure_app
from database import init_db

app = Flask(__name__)
configure_app(app)
CORS(app, supports_credentials=True)
init_db()
register_routes(app)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
