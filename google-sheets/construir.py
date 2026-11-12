"""Genera Codigo.gs (un solo archivo para pegar en Apps Script) a partir de src/*.gs y Web.html."""
import pathlib, sys
here = pathlib.Path(__file__).resolve().parent
partes = sorted((here / "src").glob("*.gs"))
codigo = "\n".join(p.read_text(encoding="utf-8") for p in partes)
html = (here / "Web.html").read_text(encoding="utf-8")
if "`" in html or "${" in html:
    sys.exit("Web.html no puede contener ` ni ${")
codigo += "\nconst WEB_HTML = String.raw`" + html + "`;\n"
(here / "Codigo.gs").write_text(codigo, encoding="utf-8")
print("Codigo.gs generado:", len(codigo), "caracteres,", codigo.count("\n"), "líneas")
