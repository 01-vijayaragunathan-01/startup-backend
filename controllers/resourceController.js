import Resource from "../models/resourceModel.js";
import mongoose from "mongoose";

// Get all resources
export const getResources = async (req, res) => {
  try {
    const resources = await Resource.find().sort({ createdAt: -1 });
    res.json(resources);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch resources", error: err.message });
  }
};

// Add a new resource
export const addResource = async (req, res) => {
  const { title, description, link, type, image } = req.body;

  try {
    const newResource = await Resource.create({
      title,
      description,
      link,
      type,
      image,
      creator: req.user._id, // save who created it
    });

    res.status(201).json(newResource);
  } catch (err) {
    res.status(500).json({ message: "Failed to add resource", error: err.message });
  }
};


// Delete a resource
export const deleteResource = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid resource ID" });
    }

    const resource = await Resource.findById(id);

    if (!resource) {
      return res.status(404).json({ message: "Resource not found" });
    }

    if (resource.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You are not allowed to delete this resource" });
    }

    await Resource.findByIdAndDelete(id);
    res.status(200).json({ message: "Resource deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err.message);
    res.status(500).json({ message: "Failed to delete resource", error: err.message });
  }
};
