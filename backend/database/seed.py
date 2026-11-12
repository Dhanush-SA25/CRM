"""
Database seeder — populates the database with sample data for development.
Run via:  flask seed
"""
from datetime import datetime, timedelta
import random

from database.db import db


def seed_database(app):
    """Seed the database with sample data."""
    with app.app_context():
        # Import models here to avoid circular imports
        from models.user import User
        from models.customer import Customer
        from models.lead import Lead
        from models.deal import Deal
        from models.activity import Activity
        from models.deal import STAGE_PROBABILITIES

        # Only seed if the database is empty
        if User.query.count() > 0:
            print("Database already seeded. Skipping.")
            return

        print("Seeding database...")

        # --- Users ---
        admin = User(
            name="Admin User",
            email="admin@smartcrm.com",
            role="admin",
        )
        admin.set_password("admin123")

        sales_rep = User(
            name="Jane Smith",
            email="jane@smartcrm.com",
            role="sales",
        )
        sales_rep.set_password("jane123")

        db.session.add_all([admin, sales_rep])
        db.session.flush()

        # --- Customers ---
        customers_data = [
            {"name": "Acme Corp", "email": "contact@acme.com", "phone": "+1-555-0101", "company": "Acme Corp", "status": "active"},
            {"name": "Globex Inc", "email": "info@globex.com", "phone": "+1-555-0102", "company": "Globex Inc", "status": "active"},
            {"name": "Initech LLC", "email": "hello@initech.com", "phone": "+1-555-0103", "company": "Initech LLC", "status": "inactive"},
            {"name": "Umbrella Ltd", "email": "biz@umbrella.com", "phone": "+1-555-0104", "company": "Umbrella Ltd", "status": "active"},
            {"name": "Stark Industries", "email": "tony@stark.com", "phone": "+1-555-0105", "company": "Stark Industries", "status": "prospect"},
        ]
        customers = []
        for c in customers_data:
            customer = Customer(**c, assigned_to=admin.id)
            db.session.add(customer)
            customers.append(customer)
        db.session.flush()

        # --- Leads ---
        leads_data = [
            {"name": "Bob Johnson", "email": "bob@email.com", "company": "Johnson & Co", "status": "new", "source": "website"},
            {"name": "Alice Wong", "email": "alice@email.com", "company": "Wong Enterprises", "status": "contacted", "source": "referral"},
            {"name": "Carlos Ruiz", "email": "carlos@email.com", "company": "Ruiz Tech", "status": "qualified", "source": "linkedin"},
            {"name": "Diana Prince", "email": "diana@email.com", "company": "Wonder Corp", "status": "new", "source": "cold_call"},
        ]
        for l in leads_data:
            lead = Lead(**l, assigned_to=sales_rep.id)
            db.session.add(lead)

        # --- Deals ---
        stages = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]
        for i, customer in enumerate(customers):
            deal = Deal(
                title=f"Deal with {customer.company}",
                value=random.randint(5000, 100000),
                stage=stages[i % len(stages)],
                probability=STAGE_PROBABILITIES[stages[i % len(stages)]],
                close_date=datetime.utcnow() + timedelta(days=random.randint(10, 90)),
                customer_id=customer.id,
                assigned_to=admin.id,
            )
            db.session.add(deal)

        db.session.commit()
        print("Database seeded successfully.")
