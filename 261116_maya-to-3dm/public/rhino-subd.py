# Rhino 8/9 Python script. Run inside Rhino, AFTER opening the exported .3dm.
# Commands: _RunPythonScript -> choose this file -> Save As.
# Requires RhinoCommon; this script cannot run in a generic CPython interpreter.
import System
import Rhino
import scriptcontext as sc


def convert_meshes_to_subds():
    doc = sc.doc
    candidates = []
    for obj in doc.Objects:
        if isinstance(obj.Geometry, Rhino.Geometry.Mesh):
            candidates.append((obj.Id, obj.Geometry.DuplicateMesh(), obj.Attributes.Duplicate()))

    if not candidates:
        print("No Rhino mesh objects found in the active document.")
        return

    converted = 0
    failed = []
    for object_id, mesh, attrs in candidates:
        try:
            # Smooth option uses mesh vertices as control NET points (not fitted
            # points on the limit surface); this matches Maya's cage workflow.
            options = Rhino.Geometry.SubDCreationOptions.Smooth
            options.InterpolateMeshVertices = False
            subd = Rhino.Geometry.SubD.CreateFromMesh(mesh, options)
            if subd is None or not subd.IsValid:
                failed.append(attrs.Name or str(object_id))
                continue
            new_id = doc.Objects.AddSubD(subd, attrs)
            if new_id == System.Guid.Empty:
                failed.append(attrs.Name or str(object_id))
                continue
            doc.Objects.Delete(object_id, True)
            converted += 1
        except Exception as exc:
            print("Failed: {} ({})".format(attrs.Name, exc))
            failed.append(attrs.Name or str(object_id))
        finally:
            mesh.Dispose()

    doc.Views.Redraw()
    print("Converted {} of {} polygon meshes to native Rhino SubD.".format(
        converted, len(candidates)))
    if failed:
        print("Unconverted: " + ", ".join(failed))
    print("Save this document as a new .3dm to retain the native SubD objects.")


if __name__ == "__main__":
    convert_meshes_to_subds()
