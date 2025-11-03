const myImage = document.querySelector("img");

myImage.addEventListener("click", () => {
  const mySrc = myImage.getAttribute("src");
  if (mySrc == "images/skin.png") {
    myImage.setAttribute("src", "images/skin-muscles.png");
  } else {
    myImage.setAttribute("src", "images/skin.png");
  }
});

const myHeading = document.querySelector("h1");
let myButton = document.querySelector("button");

function setUserName() {
  const myName = prompt("Please enter your name.");
  if (!myName) {
    setUserName();
  } else {
    localStorage.setItem("name", myName);
    myHeading.textContent = `Welcome To My Website, ${myName}`;
  }
}

if (!localStorage.getItem("name")) {
  setUserName();
} else {
  const storedName = localStorage.getItem("name");
  myHeading.textContent = `Welcome To My Website, ${storedName}`;
}

myButton.addEventListener("click", () => {
  setUserName();
});
