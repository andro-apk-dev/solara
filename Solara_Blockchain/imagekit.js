const express = require("express");
const ImageKit = require("imagekit");
const router = express.Router();

const imagekit=new ImageKit(
  {
    publicKey:"public_mFMG1Zh9tb95RM+vORV7NAU+B0E=",
    privateKey: "private_RnStvgkrO+xgxGXEjttAYTAo6m4=",
    urlEndpoint:"https://ik.imagekit.io/3ihkaavnfb",
  }
);

router.get("/", (req, res) => {
  const authParams = imagekit.getAuthenticationParameters();
  console.log(authParams);
  res.send(authParams);
});

module.exports = router;
