import fs from "fs"

export async function output(network: string, _newData: object = {}) {
	await fs.open(`./${network}-deployment.json`, "w+", (err, fd) => {
		if (err) console.log(err)
	})
	let data = fs.readFileSync(`./${network}-deployment.json`, {
		encoding: "utf-8",
	})
	if (data == "") data = "{}"

	fs.writeFileSync(
		`./${network}-deployment.json`,
		JSON.stringify({ ...JSON.parse(data), ..._newData }),
		{ flag: "w+" }
	)
}
