"""Source-ID registry used by dataset imports.

A mapping row ties an external CSV identifier to the local primary key of the
imported record, so re-running an import updates rows instead of duplicating
them and cross-file foreign keys can be resolved without trusting CSV IDs to
match local IDs.
"""
from datetime import datetime

from database.db import db


class ImportMapping(db.Model):
    __tablename__ = "import_mappings"
    __table_args__ = (
        db.UniqueConstraint("entity_type", "source_id", name="uq_import_mapping_entity_source"),
    )

    id = db.Column(db.Integer, primary_key=True)
    entity_type = db.Column(db.String(30), nullable=False, index=True)
    source_id = db.Column(db.String(60), nullable=False, index=True)
    local_id = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "entity_type": self.entity_type,
            "source_id": self.source_id,
            "local_id": self.local_id,
        }
