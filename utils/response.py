from flask import jsonify, send_file


def ok(message="Thành công", data=None, status=200):
    return jsonify({"success": True, "message": message, "data": data or {}}), status


def fail(message="Có lỗi xảy ra", status=400):
    return jsonify({"success": False, "message": message, "data": {}}), status


def send_file_response(path, filename, mimetype):
    try:
        return send_file(path, as_attachment=True, download_name=filename, mimetype=mimetype)
    except TypeError:
        return send_file(path, as_attachment=True, attachment_filename=filename, mimetype=mimetype)
