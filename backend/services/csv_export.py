"""Shared CSV response helpers."""
import csv
from datetime import datetime
from io import StringIO

from flask import Response

# Cells starting with these characters can be interpreted as formulas by
# spreadsheet apps, so they are escaped with a leading apostrophe.
FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def csv_cell(value):
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.isoformat()
    text = str(value)
    if text.startswith(FORMULA_PREFIXES):
        return "'" + text
    return text


def csv_response(headers, rows, resource):
    buffer = StringIO()
    buffer.write("\ufeff")  # BOM so Excel opens UTF-8 correctly
    writer = csv.writer(buffer)
    writer.writerow(headers)
    for row in rows:
        writer.writerow([csv_cell(value) for value in row])

    filename = f"smartcrm-{resource}-{datetime.utcnow().strftime('%Y%m%d-%H%M')}.csv"
    return Response(
        buffer.getvalue(),
        mimetype="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
