let Parser = require('rss-parser')
let parser = new Parser({
	customFields: {
		item: [
			['media:content', 'media'],
			['pepper:merchant', 'merchant'],
		]
	}
})
let known
try {
	known = require('./known.json')
} catch {}

async function GetFeed() {
	const results = []
	let feed = await parser.parseURL('https://www.hotukdeals.com/rss/deals')
	let items = feed.items

	if (known) {
		items = items.filter(item => !known.includes(item.guid))
	}
	known = items.map(item => item.guid)
	await writeFile('./known.json', JSON.stringify(known))

	for (const item of items) {
		const include = false
		const merchant = item['merchant']['$']['name']
		const titleLC = item.title.toLowerCase()

		if (merchant == 'Amazon') {
			if (titleLC.includes('credit') || /£\d+ off/.exec(titleLC) !== null || titleLC.includes('promotional')) {
				include = true
			}
		} else if (merchant == 'eBay') {
			if (/\d+\%/.exec(titleLC) !== null && !titleLC.includes('selected sellers')) {
				include = true
			}
		} else if (merchant == 'O2 Priority') {
			include = true
		} else if (merchant == 'Stickermule' && titleLC.includes('stickers')) {
			include = true
		} else if (merchant == 'Topcashback') {
			if (!titleLC.includes('new customers only') && !titleLC.includes('tell-a-friend')) {
				include = true
			}
		}

		if (include) {
			const date = item.isoDate
			const url = item.link
			const image = item['media']['$']['url'] // 100x100, 150x150, 300x300, 1024x1024
			const price = item['merchant']['$']['price'] ?? null
			const contentHtml = item.content
			const contentText = item.contentSnippet.replace(/[[a-z].+?\]/g, '').trim()
			const title = item.title

			results.push({
				title,
				merchant,
				date,
				url,
				image,
				price,
				contentHtml,
				contentText
			})
		}
	}

	return results
}

(async () => {
	const posts = await GetFeed()

	for (const post of posts) {
		const payload = {
			embeds: [
				{
					title: post.title,
					timestamp: post.date,
					fields: [
						{
							name: 'Merchant',
							value: post.merchant
						},
						{
							name: 'Price',
							value: post.price
						}
					],
					description: post.contentText,
					url: post.url,
					image: {
						url: post.image.replace('150x150', '1024x1024')
					}
				}
			]
		}

		const request = new Request(
			process.env.WEBHOOK_URL,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			}
		)
		await fetch(request)
	}

})()